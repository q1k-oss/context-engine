import Anthropic from '@anthropic-ai/sdk';
import { encode } from '@q1k-oss/mint-format';
import type { ClaudeContext, ClaudeMessage } from '../../types/index.js';
import { getConfig } from '../../config.js';

let anthropic: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic({
      apiKey: getConfig().anthropicApiKey,
    });
  }
  return anthropic;
}

/**
 * Build the system prompt including knowledge graph context.
 * Uses MINT format for structured data to reduce token usage (~47% savings).
 */
function buildSystemPrompt(context: ClaudeContext): string {
  let systemPrompt = context.systemPrompt || 'You are a helpful AI assistant.';

  const hasNodes = context.relevantNodes.length > 0;
  const hasEdges = context.relevantEdges.length > 0;

  if (hasNodes || hasEdges) {
    systemPrompt += '\n\n---\n## CAPTURED KNOWLEDGE (from conversation so far)\n';
    systemPrompt += '(Data below is in MINT format — a compact table notation)\n';

    if (hasNodes) {
      const nodesData = context.relevantNodes.map((n) => ({
        name: n.name,
        type: n.type,
        ...(n.description ? { description: n.description } : {}),
      }));
      systemPrompt += `\n${encode({ nodes: nodesData })}\n`;
    }

    if (hasEdges) {
      const edgesData = context.relevantEdges.map((e) => ({
        source: e.source,
        relationship: e.relationship.replace(/_/g, ' ').toLowerCase(),
        target: e.target,
      }));
      systemPrompt += `\n${encode({ relationships: edgesData })}\n`;
    }

    systemPrompt += `\nstats: ${context.relevantNodes.length} nodes, ${context.relevantEdges.length} relationships captured\n`;
  } else {
    systemPrompt += '\n\n---\n## CAPTURED KNOWLEDGE\n*No knowledge captured yet. Start by understanding the user\'s requirements.*\n';
  }

  return systemPrompt;
}

/**
 * Claude Client Service for streaming completions
 * Claude is the PRIMARY reasoning engine - receives full conversation history
 */
export const claudeClientService = {
  /**
   * Create a streaming completion with Claude
   * IMPORTANT: Always send full conversation history, no summarization
   */
  async *createStreamingCompletion(
    context: ClaudeContext
  ): AsyncGenerator<{ type: 'text_delta' | 'done'; content: string }> {
    const systemPrompt = buildSystemPrompt(context);

    // Convert messages to Anthropic format
    const messages: Anthropic.MessageParam[] = context.messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    const stream = await getClient().messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages,
    });

    let accumulated = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        accumulated += event.delta.text;
        yield { type: 'text_delta', content: event.delta.text };
      }
    }

    yield { type: 'done', content: accumulated };
  },

  /**
   * Non-streaming completion for internal processing
   */
  async createCompletion(context: ClaudeContext): Promise<string> {
    const systemPrompt = buildSystemPrompt(context);

    const messages: Anthropic.MessageParam[] = context.messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages,
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock?.type === 'text' ? textBlock.text : '';
  },

  /**
   * Extract entities and relationships from a message
   * Used by the graph builder service
   */
  async extractGraphElements(
    content: string,
    existingNodes: Array<{ name: string; type: string }>
  ): Promise<{
    entities: Array<{ name: string; type: string; confidence: number; properties?: Record<string, unknown> }>;
    concepts: Array<{ name: string; confidence: number; properties?: Record<string, unknown> }>;
    relationships: Array<{ source: string; target: string; type: string; confidence: number }>;
  }> {
    const existingContext = existingNodes.length > 0
      ? `Existing entities in context (MINT format):\n${encode({ entities: existingNodes })}`
      : 'Existing entities in context: None yet';

    const prompt = `Analyze this message and extract structured information.

${existingContext}

Message to analyze:
"${content}"

Extract and return as JSON:
1. entities: Named entities (people, organizations, products, technologies, etc.)
2. concepts: Abstract concepts, topics, or domains being discussed
3. relationships: Connections between any entities/concepts

Return ONLY valid JSON in this exact format:
{
  "entities": [{"name": "EntityName", "type": "person|organization|product|technology|other", "confidence": 0.0-1.0}],
  "concepts": [{"name": "ConceptName", "confidence": 0.0-1.0}],
  "relationships": [{"source": "Name1", "target": "Name2", "type": "RELATES_TO|CAUSES|DEPENDS_ON|DECIDED_BY", "confidence": 0.0-1.0}]
}

Be conservative - only extract entities/concepts with confidence > 0.5. Focus on concrete, actionable information.`;

    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const responseText = textBlock?.type === 'text' ? textBlock.text : '{}';

    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse graph extraction response:', e);
    }

    return { entities: [], concepts: [], relationships: [] };
  },

  /**
   * Generate a concise chat title from the first message exchange
   */
  async generateChatTitle(userMessage: string, assistantResponse: string): Promise<string> {
    try {
      const response = await getClient().messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 50,
        messages: [
          {
            role: 'user',
            content: `Generate a very short, concise title (3-6 words max) for this conversation. Return ONLY the title text, no quotes or punctuation.

User message: ${userMessage.substring(0, 300)}

Assistant response: ${assistantResponse.substring(0, 300)}`,
          },
        ],
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      const title = textBlock?.type === 'text' ? textBlock.text.trim() : 'New Conversation';
      // Clean up and limit length
      return title.replace(/^["']|["']$/g, '').substring(0, 60);
    } catch (error) {
      console.error('Failed to generate chat title:', error);
      return userMessage.length > 40 ? userMessage.substring(0, 40) + '...' : userMessage;
    }
  },
};
