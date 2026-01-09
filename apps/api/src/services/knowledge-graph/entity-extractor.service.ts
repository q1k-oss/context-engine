import { claudeClientService } from '../llm/claude-client.service.js';
import type { ExtractionResult, NodeType } from '@context-engine/shared';

/**
 * Entity Extractor Service
 * Extracts entities, concepts, events, intents, and decisions from messages
 */
export const entityExtractorService = {
  /**
   * Extract all graph elements from a message
   */
  async extract(
    content: string,
    existingNodes: Array<{ name: string; type: string }>
  ): Promise<ExtractionResult> {
    const extraction = await claudeClientService.extractGraphElements(content, existingNodes);

    const result: ExtractionResult = {
      entities: [],
      concepts: [],
      events: [],
      intents: [],
      decisions: [],
      artifacts: [],
    };

    // Map extracted entities
    for (const entity of extraction.entities) {
      if (entity.confidence >= 0.5) {
        result.entities.push({
          name: entity.name,
          confidence: entity.confidence,
          properties: {
            entityType: entity.type,
            ...entity.properties,
          },
        });
      }
    }

    // Map extracted concepts
    for (const concept of extraction.concepts) {
      if (concept.confidence >= 0.5) {
        result.concepts.push({
          name: concept.name,
          confidence: concept.confidence,
          properties: concept.properties || {},
        });
      }
    }

    return result;
  },

  /**
   * Extract intents from user messages
   */
  async extractIntents(
    userMessage: string
  ): Promise<Array<{ name: string; confidence: number; properties: Record<string, unknown> }>> {
    // Simple intent extraction based on message patterns
    const intents: Array<{ name: string; confidence: number; properties: Record<string, unknown> }> = [];

    // Question intent
    if (userMessage.includes('?') || /^(what|how|why|when|where|who|which|can|could|would|should)/i.test(userMessage)) {
      intents.push({
        name: 'Question',
        confidence: 0.8,
        properties: { type: 'inquiry' },
      });
    }

    // Request intent
    if (/^(please|can you|could you|help me|i need|i want)/i.test(userMessage)) {
      intents.push({
        name: 'Request',
        confidence: 0.8,
        properties: { type: 'action_request' },
      });
    }

    // Explanation intent
    if (/explain|describe|tell me about|what is/i.test(userMessage)) {
      intents.push({
        name: 'Explanation Request',
        confidence: 0.7,
        properties: { type: 'explanation' },
      });
    }

    return intents;
  },

  /**
   * Extract decisions from assistant messages
   */
  async extractDecisions(
    assistantMessage: string
  ): Promise<Array<{ name: string; confidence: number; properties: Record<string, unknown> }>> {
    const decisions: Array<{ name: string; confidence: number; properties: Record<string, unknown> }> = [];

    // Look for decision patterns
    if (/i recommend|i suggest|you should|the best approach|i've decided|let's go with/i.test(assistantMessage)) {
      decisions.push({
        name: 'Recommendation Made',
        confidence: 0.7,
        properties: { type: 'recommendation' },
      });
    }

    return decisions;
  },
};
