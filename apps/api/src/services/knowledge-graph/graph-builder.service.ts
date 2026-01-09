import { db } from '@context-engine/db';
import { knowledgeNodes, knowledgeEdges, contextDeltas, graphVersions, messages } from '@context-engine/db/schema';
import { eq, and, desc, gte } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type {
  Message,
  KnowledgeNode,
  KnowledgeEdge,
  ContextDelta,
  GraphBuildResult,
  NodeType,
  EdgeType,
} from '@context-engine/shared';
import { entityExtractorService } from './entity-extractor.service.js';
import { relationshipInferrerService } from './relationship-inferrer.service.js';
import { priorityCalculatorService } from './priority-calculator.service.js';
import { ageClientService } from '../graph/age-client.service.js';

// Flag to enable/disable AGE sync (can be controlled via env var)
const AGE_ENABLED = process.env.AGE_ENABLED !== 'false';

/**
 * Graph Builder Service
 * Converts messages into knowledge graph nodes and edges
 */
export const graphBuilderService = {
  /**
   * Process a message and update the knowledge graph
   */
  async processMessage(sessionId: string, message: Message): Promise<GraphBuildResult> {
    // Get existing graph
    const existingNodes = await db.query.knowledgeNodes.findMany({
      where: and(
        eq(knowledgeNodes.sessionId, sessionId),
        eq(knowledgeNodes.isDeleted, false)
      ),
    });

    const existingEdges = await db.query.knowledgeEdges.findMany({
      where: and(
        eq(knowledgeEdges.sessionId, sessionId),
        eq(knowledgeEdges.isDeleted, false)
      ),
    });

    // Get current version
    const latestVersion = await db.query.graphVersions.findFirst({
      where: eq(graphVersions.sessionId, sessionId),
      orderBy: [desc(graphVersions.version)],
    });
    const currentVersion = latestVersion?.version || 0;
    const newVersion = currentVersion + 1;

    // Extract entities and concepts from the message
    const existingNodeNames = existingNodes.map((n) => ({
      name: n.name,
      type: n.nodeType,
    }));
    const extraction = await entityExtractorService.extract(message.content, existingNodeNames);

    // Also extract intents/decisions based on role
    if (message.role === 'user') {
      const intents = await entityExtractorService.extractIntents(message.content);
      extraction.intents.push(...intents);
    } else if (message.role === 'assistant') {
      const decisions = await entityExtractorService.extractDecisions(message.content);
      extraction.decisions.push(...decisions);
    }

    const nodesAdded: KnowledgeNode[] = [];
    const nodesModified: KnowledgeNode[] = [];
    const edgesAdded: KnowledgeEdge[] = [];

    // Helper to find similar existing node
    const findSimilarNode = (name: string): KnowledgeNode | undefined => {
      const lowerName = name.toLowerCase();
      return existingNodes.find((n) => {
        const existingLower = n.name.toLowerCase();
        // Exact match or contained within
        return (
          existingLower === lowerName ||
          existingLower.includes(lowerName) ||
          lowerName.includes(existingLower)
        );
      }) as KnowledgeNode | undefined;
    };

    // Process entities
    for (const entity of extraction.entities) {
      const existing = findSimilarNode(entity.name);
      if (existing) {
        // Update existing node
        const updatedAt = new Date();
        await db
          .update(knowledgeNodes)
          .set({
            graphData: {
              ...(existing.graphData as Record<string, unknown>),
              ...entity.properties,
            },
            confidenceScore: String(Math.max(Number(existing.confidenceScore), entity.confidence)),
            updatedAt,
            version: existing.version + 1,
          })
          .where(eq(knowledgeNodes.id, existing.id));

        nodesModified.push({
          ...existing,
          graphData: { ...(existing.graphData as Record<string, unknown>), ...entity.properties },
          confidenceScore: Math.max(Number(existing.confidenceScore), entity.confidence),
          updatedAt,
        } as KnowledgeNode);
      } else {
        // Create new node
        const newNode = {
          id: uuidv4(),
          sessionId,
          nodeType: 'Entity' as NodeType,
          name: entity.name,
          graphData: entity.properties,
          confidenceScore: String(entity.confidence),
          priorityScore: '0.50',
          sourceMessageId: message.id,
          version: 1,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await db.insert(knowledgeNodes).values(newNode);
        nodesAdded.push(newNode as unknown as KnowledgeNode);
      }
    }

    // Process concepts
    for (const concept of extraction.concepts) {
      const existing = findSimilarNode(concept.name);
      if (!existing) {
        const newNode = {
          id: uuidv4(),
          sessionId,
          nodeType: 'Concept' as NodeType,
          name: concept.name,
          graphData: concept.properties,
          confidenceScore: String(concept.confidence),
          priorityScore: '0.50',
          sourceMessageId: message.id,
          version: 1,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await db.insert(knowledgeNodes).values(newNode);
        nodesAdded.push(newNode as unknown as KnowledgeNode);
      }
    }

    // Process intents
    for (const intent of extraction.intents) {
      const newNode = {
        id: uuidv4(),
        sessionId,
        nodeType: 'Intent' as NodeType,
        name: intent.name,
        graphData: intent.properties,
        confidenceScore: String(intent.confidence),
        priorityScore: '0.70', // Intents get higher priority
        sourceMessageId: message.id,
        version: 1,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.insert(knowledgeNodes).values(newNode);
      nodesAdded.push(newNode as unknown as KnowledgeNode);
    }

    // Process decisions
    for (const decision of extraction.decisions) {
      const newNode = {
        id: uuidv4(),
        sessionId,
        nodeType: 'Decision' as NodeType,
        name: decision.name,
        graphData: decision.properties,
        confidenceScore: String(decision.confidence),
        priorityScore: '0.80', // Decisions get highest priority
        sourceMessageId: message.id,
        version: 1,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.insert(knowledgeNodes).values(newNode);
      nodesAdded.push(newNode as unknown as KnowledgeNode);
    }

    // Infer relationships
    const allNodes = [...existingNodes, ...nodesAdded] as KnowledgeNode[];
    // Convert edge weight from string to number for type compatibility
    const typedEdges = existingEdges.map((e) => ({
      ...e,
      weight: Number(e.weight),
      edgeData: e.edgeData as Record<string, unknown>,
    })) as KnowledgeEdge[];
    const relationships = await relationshipInferrerService.infer(
      message.content,
      allNodes,
      typedEdges
    );

    for (const rel of relationships) {
      const newEdge = {
        id: uuidv4(),
        sessionId,
        sourceNodeId: rel.sourceNodeId,
        targetNodeId: rel.targetNodeId,
        edgeType: rel.edgeType,
        edgeData: rel.context ? { context: rel.context } : {},
        weight: String(rel.weight),
        isDeleted: false,
        createdAt: new Date(),
      };

      await db.insert(knowledgeEdges).values(newEdge);
      edgesAdded.push(newEdge as unknown as KnowledgeEdge);
    }

    // Recalculate priorities
    const recentMessages = await db.query.messages.findMany({
      where: eq(messages.sessionId, sessionId),
      orderBy: [desc(messages.sequenceNumber)],
      limit: 10,
    });

    const priorityUpdates = priorityCalculatorService.recalculate(
      allNodes,
      recentMessages as Message[],
      message.content
    );

    for (const update of priorityUpdates) {
      await db
        .update(knowledgeNodes)
        .set({ priorityScore: String(update.newPriority), updatedAt: new Date() })
        .where(eq(knowledgeNodes.id, update.nodeId));
    }

    // Create context delta
    const deltaData = {
      additions: {
        nodes: nodesAdded,
        edges: edgesAdded,
      },
      modifications: {
        nodes: nodesModified.map((n) => ({
          nodeId: n.id,
          previousData: {},
          newData: n,
          changedFields: ['graphData', 'confidenceScore'],
        })),
        edges: [],
        priorities: priorityUpdates,
      },
      removals: {
        nodeIds: [],
        edgeIds: [],
      },
    };

    const delta: ContextDelta = {
      id: uuidv4(),
      sessionId,
      versionFrom: currentVersion,
      versionTo: newVersion,
      triggerMessageId: message.id,
      additions: deltaData.additions,
      modifications: deltaData.modifications,
      removals: deltaData.removals,
      summary: `Added ${nodesAdded.length} nodes, modified ${nodesModified.length} nodes, added ${edgesAdded.length} edges`,
      statistics: {
        additions: nodesAdded.length + edgesAdded.length,
        modifications: nodesModified.length + priorityUpdates.length,
        removals: 0,
      },
      createdAt: new Date(),
    };

    await db.insert(contextDeltas).values({
      id: delta.id,
      sessionId,
      versionFrom: currentVersion,
      versionTo: newVersion,
      triggerMessageId: message.id,
      deltaData,
      createdAt: new Date(),
    });

    // Create graph version snapshot
    const updatedNodes = await db.query.knowledgeNodes.findMany({
      where: and(
        eq(knowledgeNodes.sessionId, sessionId),
        eq(knowledgeNodes.isDeleted, false)
      ),
    });
    const updatedEdges = await db.query.knowledgeEdges.findMany({
      where: and(
        eq(knowledgeEdges.sessionId, sessionId),
        eq(knowledgeEdges.isDeleted, false)
      ),
    });

    await db.insert(graphVersions).values({
      id: uuidv4(),
      sessionId,
      version: newVersion,
      graphSnapshot: {
        sessionId,
        version: newVersion,
        nodes: updatedNodes,
        edges: updatedEdges,
        createdAt: new Date(),
      },
      createdAt: new Date(),
    });

    return {
      nodesAdded,
      nodesModified,
      nodesRemoved: [],
      edgesAdded,
      edgesModified: [],
      edgesRemoved: [],
      delta,
    };
  },

  /**
   * Get the current knowledge graph for a session
   */
  async getGraph(sessionId: string) {
    const nodes = await db.query.knowledgeNodes.findMany({
      where: and(
        eq(knowledgeNodes.sessionId, sessionId),
        eq(knowledgeNodes.isDeleted, false)
      ),
    });

    const edges = await db.query.knowledgeEdges.findMany({
      where: and(
        eq(knowledgeEdges.sessionId, sessionId),
        eq(knowledgeEdges.isDeleted, false)
      ),
    });

    const latestVersion = await db.query.graphVersions.findFirst({
      where: eq(graphVersions.sessionId, sessionId),
      orderBy: [desc(graphVersions.version)],
    });

    return {
      sessionId,
      version: latestVersion?.version || 0,
      nodes,
      edges,
      createdAt: new Date(),
    };
  },

  /**
   * Get prioritized context for Claude
   */
  async getPrioritizedContext(sessionId: string, minPriority?: number) {
    const threshold = minPriority ?? priorityCalculatorService.getMinPriorityThreshold();

    const nodes = await db.query.knowledgeNodes.findMany({
      where: and(
        eq(knowledgeNodes.sessionId, sessionId),
        eq(knowledgeNodes.isDeleted, false),
        gte(knowledgeNodes.priorityScore, String(threshold))
      ),
      orderBy: [desc(knowledgeNodes.priorityScore)],
      limit: 50,
    });

    const nodeIds = nodes.map((n) => n.id);

    const edges = await db.query.knowledgeEdges.findMany({
      where: and(
        eq(knowledgeEdges.sessionId, sessionId),
        eq(knowledgeEdges.isDeleted, false)
      ),
    });

    // Filter edges to only those connecting prioritized nodes
    const relevantEdges = edges.filter(
      (e) => nodeIds.includes(e.sourceNodeId) && nodeIds.includes(e.targetNodeId)
    );

    return {
      nodes: nodes.map((n) => ({
        name: n.name,
        type: n.nodeType,
        description: (n.graphData as Record<string, unknown>)?.description as string | undefined,
        priority: Number(n.priorityScore),
      })),
      edges: relevantEdges.map((e) => {
        const sourceNode = nodes.find((n) => n.id === e.sourceNodeId);
        const targetNode = nodes.find((n) => n.id === e.targetNodeId);
        return {
          source: sourceNode?.name || '',
          target: targetNode?.name || '',
          relationship: e.edgeType,
        };
      }),
    };
  },

  /**
   * Sync a node to Apache AGE graph
   */
  async syncNodeToAGE(node: KnowledgeNode): Promise<void> {
    if (!AGE_ENABLED) return;

    try {
      await ageClientService.createNode(node.sessionId, node.nodeType, {
        id: node.id,
        name: node.name,
        confidenceScore: Number(node.confidenceScore),
        priorityScore: Number(node.priorityScore),
        ...(node.graphData as Record<string, unknown>),
      });
    } catch (error) {
      console.error('Failed to sync node to AGE:', error);
    }
  },

  /**
   * Sync an edge to Apache AGE graph
   */
  async syncEdgeToAGE(edge: KnowledgeEdge): Promise<void> {
    if (!AGE_ENABLED) return;

    try {
      await ageClientService.createRelationship(
        edge.sourceNodeId,
        edge.targetNodeId,
        edge.edgeType,
        {
          weight: Number(edge.weight),
          ...(edge.edgeData as Record<string, unknown>),
        }
      );
    } catch (error) {
      console.error('Failed to sync edge to AGE:', error);
    }
  },

  /**
   * Find shortest path between two nodes using Cypher
   */
  async findShortestPath(startNodeId: string, endNodeId: string) {
    if (!AGE_ENABLED) {
      throw new Error('AGE is not enabled');
    }
    return ageClientService.findShortestPath(startNodeId, endNodeId);
  },

  /**
   * Find all paths between nodes using Cypher
   */
  async findPaths(startNodeId: string, endNodeId: string, maxHops: number = 5) {
    if (!AGE_ENABLED) {
      throw new Error('AGE is not enabled');
    }
    return ageClientService.findPaths(startNodeId, endNodeId, maxHops);
  },

  /**
   * Get node neighbors using Cypher
   */
  async getNodeNeighbors(nodeId: string, direction: 'in' | 'out' | 'both' = 'both') {
    if (!AGE_ENABLED) {
      throw new Error('AGE is not enabled');
    }
    return ageClientService.getNeighbors(nodeId, direction);
  },

  /**
   * Get session graph from AGE (for visualization)
   */
  async getGraphFromAGE(sessionId: string) {
    if (!AGE_ENABLED) {
      throw new Error('AGE is not enabled');
    }
    return ageClientService.getSessionGraph(sessionId);
  },

  /**
   * Execute custom Cypher query
   */
  async executeCypher<T = Record<string, unknown>>(cypher: string): Promise<T[]> {
    if (!AGE_ENABLED) {
      throw new Error('AGE is not enabled');
    }
    return ageClientService.executeCypher<T>(cypher);
  },
};
