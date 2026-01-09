import { db } from '@context-engine/db';
import { sessions, messages } from '@context-engine/db/schema';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { Session, Message, ClaudeContext, ClaudeMessage } from '@context-engine/shared';
import { claudeClientService } from '../llm/claude-client.service.js';
import { graphBuilderService } from '../knowledge-graph/graph-builder.service.js';
import { AppError } from '../../middleware/error-handler.js';

const BASE_SYSTEM_PROMPT = `You are an AI Agent Architect - a specialized assistant that helps users design and define AI agents through conversation. Your goal is to deeply understand what agent the user wants to build by asking thoughtful, incremental questions.

## YOUR ROLE
You are building a comprehensive knowledge graph of the agent's requirements through conversation. The user will give you a brief description - your job is to explore and understand the COMPLETE functionality.

## QUESTIONING STRATEGY
1. **Ask 1-2 focused questions at a time** - Never overwhelm with multiple questions
2. **Start broad, then go deep** - Understand the big picture first, then drill into specifics
3. **Acknowledge what you've learned** - Briefly confirm understanding before asking more
4. **Cover all dimensions systematically**:
   - PURPOSE: What problem does this agent solve? Who uses it?
   - ENTITIES: What data/objects does it work with? What are their attributes?
   - PROCESSES: What workflows/steps does it perform? In what order?
   - RULES: What business rules, validations, or constraints apply?
   - INTEGRATIONS: What external systems does it connect to?
   - TRIGGERS: What starts each process? (user action, schedule, event)
   - OUTPUTS: What does it produce? Reports, actions, notifications?
   - EDGE CASES: What happens when things go wrong?

## CONVERSATION FLOW
1. **Opening**: Acknowledge the initial description, identify what's clear vs unclear
2. **Exploration**: Ask questions to fill gaps, one area at a time
3. **Clarification**: When user gives brief answers, probe deeper with follow-ups
4. **Validation**: Periodically summarize your understanding and confirm
5. **Completion**: When you have enough detail, summarize the complete agent specification

## RESPONSE FORMAT
- Keep responses concise and conversational
- Use bullet points for summaries
- Bold key terms/entities you're capturing
- End each response with 1-2 clear questions (unless summarizing)

## KNOWLEDGE GRAPH CONTEXT
Below is what we've captured so far in the knowledge graph. Use this to avoid asking about things we already know and to build connections between concepts.

## IMPORTANT
- Users won't give detailed answers unprompted - you must draw out the details
- If an answer is vague, ask a specific follow-up
- Track what you've learned vs what's still unknown
- The goal is a COMPLETE specification that can be used to build the agent`;

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

    // Auto-generate session title from first user message
    if (nextSequence === 1 && session.title === 'New Conversation') {
      const title = content.length > 50 ? content.substring(0, 50) + '...' : content;
      await db.update(sessions).set({ title }).where(eq(sessions.id, sessionId));
    }

    // Process both messages for knowledge graph (async, non-blocking)
    // Uses smart processing to automatically detect documentation and use domain extraction
    try {
      const userGraphResult = await graphBuilderService.processMessageSmart(sessionId, userMessage as Message);
      const assistantGraphResult = await graphBuilderService.processMessageSmart(sessionId, assistantMessage as Message);

      const totalNodesAdded = userGraphResult.nodesAdded.length + assistantGraphResult.nodesAdded.length;
      const totalNodesModified = userGraphResult.nodesModified.length + assistantGraphResult.nodesModified.length;
      const latestVersion = Math.max(userGraphResult.delta.versionTo, assistantGraphResult.delta.versionTo);

      yield {
        type: 'graph_update',
        data: {
          nodesAdded: totalNodesAdded,
          nodesModified: totalNodesModified,
          newVersion: latestVersion,
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
