import type { KnowledgeNode, KnowledgeEdge, EdgeType } from '../../types/index.js';
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
