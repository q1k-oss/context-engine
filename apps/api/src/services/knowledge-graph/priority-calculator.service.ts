import type { KnowledgeNode, Message, NodeType } from '@context-engine/shared';

interface PriorityUpdate {
  nodeId: string;
  previousPriority: number;
  newPriority: number;
  reason: string;
}

/**
 * Priority Calculator Service
 * Calculates and updates node priority scores for B-Tree based retrieval
 *
 * Priority factors:
 * - Recency: More recent nodes have higher priority
 * - Relevance: Nodes mentioned in current context get boosted
 * - Confidence: Higher confidence scores contribute to priority
 * - Frequency: Nodes referenced multiple times get higher priority
 */
export const priorityCalculatorService = {
  /**
   * Recalculate priorities for all nodes in a session
   */
  recalculate(
    nodes: KnowledgeNode[],
    recentMessages: Message[],
    currentMessageContent?: string
  ): PriorityUpdate[] {
    const updates: PriorityUpdate[] = [];
    const now = Date.now();

    // Build a map of node mentions in recent messages
    const mentionCounts = new Map<string, number>();
    for (const message of recentMessages) {
      for (const node of nodes) {
        if (message.content.toLowerCase().includes(node.name.toLowerCase())) {
          mentionCounts.set(node.id, (mentionCounts.get(node.id) || 0) + 1);
        }
      }
    }

    // Calculate new priorities
    for (const node of nodes) {
      const previousPriority = Number(node.priorityScore);

      // Base priority from confidence
      let newPriority = Number(node.confidenceScore) * 0.3;

      // Recency factor (logarithmic decay over 7 days)
      // 24h: ~50%, 72h: ~33%, 7d: ~24% (vs old linear: 0% at 24h)
      const ageMs = now - new Date(node.updatedAt).getTime();
      const ageHours = ageMs / (1000 * 60 * 60);
      const recencyFactor = 1 / (1 + Math.log2(1 + ageHours / 24));
      newPriority += recencyFactor * 0.3;

      // Frequency factor
      const mentions = mentionCounts.get(node.id) || 0;
      const frequencyFactor = Math.min(1, mentions / 5); // Cap at 5 mentions
      newPriority += frequencyFactor * 0.2;

      // Current context boost
      if (currentMessageContent) {
        if (currentMessageContent.toLowerCase().includes(node.name.toLowerCase())) {
          newPriority += 0.2; // Significant boost for current context relevance
        }
      }

      // Apply node-type priority floors: Decision/Goal nodes never drop below 0.2
      const nodeType = node.nodeType as NodeType;
      const priorityFloor = (nodeType === 'Decision' || nodeType === 'Intent') ? 0.2 : 0;

      // Clamp to [floor, 1]
      newPriority = Math.max(priorityFloor, Math.min(1, newPriority));

      // Only update if there's a significant change
      if (Math.abs(newPriority - previousPriority) > 0.05) {
        let reason = 'Priority recalculation';
        if (mentions > 0) {
          reason = `Mentioned ${mentions} times in recent context`;
        } else if (recencyFactor > 0.8) {
          reason = 'Recently created/updated';
        }

        updates.push({
          nodeId: node.id,
          previousPriority,
          newPriority: Number(newPriority.toFixed(2)),
          reason,
        });
      }
    }

    return updates;
  },

  /**
   * Boost priority for a specific node
   */
  boost(node: KnowledgeNode, boostAmount: number, reason: string): PriorityUpdate {
    const previousPriority = Number(node.priorityScore);
    const newPriority = Math.min(1, previousPriority + boostAmount);

    return {
      nodeId: node.id,
      previousPriority,
      newPriority: Number(newPriority.toFixed(2)),
      reason,
    };
  },

  /**
   * Decay priority for a specific node
   */
  decay(node: KnowledgeNode, decayAmount: number, reason: string): PriorityUpdate {
    const previousPriority = Number(node.priorityScore);
    const newPriority = Math.max(0, previousPriority - decayAmount);

    return {
      nodeId: node.id,
      previousPriority,
      newPriority: Number(newPriority.toFixed(2)),
      reason,
    };
  },

  /**
   * Get the minimum priority threshold for context inclusion
   */
  getMinPriorityThreshold(): number {
    return 0.3; // Nodes below this threshold won't be included in Claude's context
  },
};
