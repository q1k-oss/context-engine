import type { KnowledgeNode, KnowledgeEdge, EdgeType } from '@context-engine/shared';
import { claudeClientService } from '../llm/claude-client.service.js';

interface InferredRelationship {
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: EdgeType;
  weight: number;
  context?: string;
}

/**
 * Relationship Inferrer Service
 * Infers relationships between nodes based on message context
 */
export const relationshipInferrerService = {
  /**
   * Infer relationships between nodes based on the message content
   */
  async infer(
    messageContent: string,
    nodes: KnowledgeNode[],
    existingEdges: KnowledgeEdge[]
  ): Promise<InferredRelationship[]> {
    if (nodes.length < 2) {
      return [];
    }

    // Get relationships from Claude extraction
    const existingNodeNames = nodes.map((n) => ({ name: n.name, type: n.nodeType }));
    const extraction = await claudeClientService.extractGraphElements(messageContent, existingNodeNames);

    const relationships: InferredRelationship[] = [];

    // Map extracted relationships to node IDs
    for (const rel of extraction.relationships) {
      const sourceNode = nodes.find((n) => n.name.toLowerCase() === rel.source.toLowerCase());
      const targetNode = nodes.find((n) => n.name.toLowerCase() === rel.target.toLowerCase());

      if (sourceNode && targetNode && sourceNode.id !== targetNode.id) {
        // Check if this relationship already exists
        const exists = existingEdges.some(
          (e) =>
            e.sourceNodeId === sourceNode.id &&
            e.targetNodeId === targetNode.id &&
            e.edgeType === rel.type
        );

        if (!exists) {
          relationships.push({
            sourceNodeId: sourceNode.id,
            targetNodeId: targetNode.id,
            edgeType: rel.type as EdgeType,
            weight: rel.confidence,
            context: messageContent.substring(0, 100),
          });
        }
      }
    }

    // Also infer temporal relationships for sequential nodes
    const sortedNodes = [...nodes].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (let i = 0; i < sortedNodes.length - 1; i++) {
      const current = sortedNodes[i];
      const next = sortedNodes[i + 1];

      // Only create temporal links if both nodes are from the same message or adjacent messages
      if (current && next) {
        const timeDiff = new Date(next.createdAt).getTime() - new Date(current.createdAt).getTime();

        // If nodes were created within 1 minute of each other, they're likely related
        if (timeDiff < 60000) {
          const exists = existingEdges.some(
            (e) =>
              e.sourceNodeId === current.id &&
              e.targetNodeId === next.id &&
              e.edgeType === 'TEMPORALLY_PRECEDES'
          );

          if (!exists) {
            relationships.push({
              sourceNodeId: current.id,
              targetNodeId: next.id,
              edgeType: 'TEMPORALLY_PRECEDES',
              weight: 0.5,
            });
          }
        }
      }
    }

    return relationships;
  },

  /**
   * Infer DERIVED_FROM relationships for file-derived content
   */
  inferFileDerivation(
    fileArtifactNodeId: string,
    extractedNodes: KnowledgeNode[]
  ): InferredRelationship[] {
    return extractedNodes.map((node) => ({
      sourceNodeId: node.id,
      targetNodeId: fileArtifactNodeId,
      edgeType: 'DERIVED_FROM' as EdgeType,
      weight: 1.0,
      context: 'Extracted from file',
    }));
  },
};
