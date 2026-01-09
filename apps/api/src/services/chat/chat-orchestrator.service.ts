import { db } from '@context-engine/db';
import { sessions, messages } from '@context-engine/db/schema';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { Session, Message, ClaudeContext, ClaudeMessage } from '@context-engine/shared';
import { claudeClientService } from '../llm/claude-client.service.js';
import { graphBuilderService } from '../knowledge-graph/graph-builder.service.js';
import { AppError } from '../../middleware/error-handler.js';

const BASE_SYSTEM_PROMPT = `You are a helpful AI assistant with access to a knowledge graph that tracks context from our conversation. Use the context provided to give relevant, consistent responses. When you learn new information, integrate it with what you already know.

Key behaviors:
- Reference previous context when relevant
- Acknowledge relationships between topics
- Build on previous decisions and discussions
- Ask for clarification when context is ambiguous`;

/**
 * Chat Orchestrator Service
 * Manages chat sessions, message history, and Claude integration
 *
 * CRITICAL: Always sends FULL conversation history to Claude - no summarization
 */
export const chatOrchestratorService = {
  /**
   * Create a new chat session
   */
  async createSession(title?: string): Promise<Session> {
    const [session] = await db
      .insert(sessions)
      .values({
        id: uuidv4(),
        title: title || 'New Conversation',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return session as Session;
  },

  /**
   * Get a session by ID with all messages
   */
  async getSession(sessionId: string) {
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session) {
      throw new AppError('SESSION_NOT_FOUND', 'Session not found', 404);
    }

    const sessionMessages = await db.query.messages.findMany({
      where: eq(messages.sessionId, sessionId),
      orderBy: [messages.sequenceNumber],
    });

    return {
      ...session,
      messages: sessionMessages,
    };
  },

  /**
   * Get all sessions
   */
  async listSessions() {
    const allSessions = await db.query.sessions.findMany({
      orderBy: [desc(sessions.updatedAt)],
    });
    return allSessions;
  },

  /**
   * Process a user message and stream Claude's response
   *
   * IMPORTANT: Full message history is always sent to Claude
   */
  async *processMessage(
    sessionId: string,
    content: string,
    fileIds?: string[]
  ): AsyncGenerator<{
    type: 'text_delta' | 'message_complete' | 'graph_update' | 'error';
    data: unknown;
  }> {
    // Verify session exists
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session) {
      yield {
        type: 'error',
        data: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
      };
      return;
    }

    // Get FULL message history - NO summarization
    const history = await db.query.messages.findMany({
      where: eq(messages.sessionId, sessionId),
      orderBy: [messages.sequenceNumber],
    });

    const nextSequence = history.length > 0 ? Math.max(...history.map((m) => m.sequenceNumber)) + 1 : 1;

    // Create user message
    const userMessage = {
      id: uuidv4(),
      sessionId,
      role: 'user' as const,
      content,
      sequenceNumber: nextSequence,
      createdAt: new Date(),
    };

    await db.insert(messages).values(userMessage);

    // Get prioritized knowledge graph context
    const graphContext = await graphBuilderService.getPrioritizedContext(sessionId);

    // Build Claude context with FULL history
    const claudeMessages: ClaudeMessage[] = [
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content },
    ];

    const claudeContext: ClaudeContext = {
      systemPrompt: BASE_SYSTEM_PROMPT,
      messages: claudeMessages,
      relevantNodes: graphContext.nodes,
      relevantEdges: graphContext.edges,
    };

    // Stream Claude's response
    let fullResponse = '';

    try {
      for await (const chunk of claudeClientService.createStreamingCompletion(claudeContext)) {
        if (chunk.type === 'text_delta') {
          fullResponse += chunk.content;
          yield {
            type: 'text_delta',
            data: { delta: chunk.content, accumulated: fullResponse },
          };
        }
      }
    } catch (error) {
      console.error('Claude streaming error:', error);
      yield {
        type: 'error',
        data: {
          code: 'CLAUDE_ERROR',
          message: error instanceof Error ? error.message : 'Claude API error',
        },
      };
      return;
    }

    // Save assistant message
    const assistantMessage = {
      id: uuidv4(),
      sessionId,
      role: 'assistant' as const,
      content: fullResponse,
      sequenceNumber: nextSequence + 1,
      tokenCount: Math.ceil(fullResponse.length / 4), // Rough estimate
      createdAt: new Date(),
    };

    await db.insert(messages).values(assistantMessage);

    // Update session timestamp
    await db
      .update(sessions)
      .set({ updatedAt: new Date() })
      .where(eq(sessions.id, sessionId));

    yield {
      type: 'message_complete',
      data: {
        messageId: assistantMessage.id,
        content: fullResponse,
        tokenCount: assistantMessage.tokenCount,
      },
    };

    // Process both messages for knowledge graph (async, non-blocking)
    try {
      await graphBuilderService.processMessage(sessionId, userMessage as Message);
      const graphResult = await graphBuilderService.processMessage(sessionId, assistantMessage as Message);

      yield {
        type: 'graph_update',
        data: {
          nodesAdded: graphResult.nodesAdded.length,
          nodesModified: graphResult.nodesModified.length,
          newVersion: graphResult.delta.versionTo,
        },
      };
    } catch (error) {
      console.error('Graph update error:', error);
      // Don't fail the whole request for graph errors
    }
  },

  /**
   * Delete a session and all associated data
   */
  async deleteSession(sessionId: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  },
};
