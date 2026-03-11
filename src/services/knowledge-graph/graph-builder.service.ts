import { getDb } from '../../db/index.js';
import { knowledgeNodes, knowledgeEdges, contextDeltas, graphVersions, messages, nodeAliases } from '../../db/schema/index.js';
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
  DomainGraph,
  DomainNode,
  DomainEdge,
  UnifiedExtractionResult,
  EntityAlias,
} from '../../types/index.js';
import { entityExtractorService } from './entity-extractor.service.js';
import { relationshipInferrerService } from './relationship-inferrer.service.js';
import { priorityCalculatorService } from './priority-calculator.service.js';
import { ageClientService } from '../graph/age-client.service.js';
import { getConfig } from '../../config.js';

// Flag to enable/disable AGE sync (can be controlled via config)
const getAgeEnabled = () => getConfig().ageEnabled !== false;

/**
 * Compute Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = a[i - 1] === b[j - 1]
        ? dp[i - 1]![j - 1]!
        : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return dp[m]![n]!;
}

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
    const existingNodes = await getDb().query.knowledgeNodes.findMany({
      where: and(
        eq(knowledgeNodes.sessionId, sessionId),
        eq(knowledgeNodes.isDeleted, false)
      ),
    });

    const existingEdges = await getDb().query.knowledgeEdges.findMany({
      where: and(
        eq(knowledgeEdges.sessionId, sessionId),
        eq(knowledgeEdges.isDeleted, false)
      ),
    });

    // Get current version
    const latestVersion = await getDb().query.graphVersions.findFirst({
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
        await getDb()
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

        await getDb().insert(knowledgeNodes).values(newNode);
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

        await getDb().insert(knowledgeNodes).values(newNode);
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

      await getDb().insert(knowledgeNodes).values(newNode);
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

      await getDb().insert(knowledgeNodes).values(newNode);
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

      await getDb().insert(knowledgeEdges).values(newEdge);
      edgesAdded.push(newEdge as unknown as KnowledgeEdge);
    }

    // Recalculate priorities
    const recentMessages = await getDb().query.messages.findMany({
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
      await getDb()
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

    await getDb().insert(contextDeltas).values({
      id: delta.id,
      sessionId,
      versionFrom: currentVersion,
      versionTo: newVersion,
      triggerMessageId: message.id,
      deltaData,
      createdAt: new Date(),
    });

    // Create graph version snapshot
    const updatedNodes = await getDb().query.knowledgeNodes.findMany({
      where: and(
        eq(knowledgeNodes.sessionId, sessionId),
        eq(knowledgeNodes.isDeleted, false)
      ),
    });
    const updatedEdges = await getDb().query.knowledgeEdges.findMany({
      where: and(
        eq(knowledgeEdges.sessionId, sessionId),
        eq(knowledgeEdges.isDeleted, false)
      ),
    });

    await getDb().insert(graphVersions).values({
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
    const nodes = await getDb().query.knowledgeNodes.findMany({
      where: and(
        eq(knowledgeNodes.sessionId, sessionId),
        eq(knowledgeNodes.isDeleted, false)
      ),
    });

    const edges = await getDb().query.knowledgeEdges.findMany({
      where: and(
        eq(knowledgeEdges.sessionId, sessionId),
        eq(knowledgeEdges.isDeleted, false)
      ),
    });

    const latestVersion = await getDb().query.graphVersions.findFirst({
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

    const nodes = await getDb().query.knowledgeNodes.findMany({
      where: and(
        eq(knowledgeNodes.sessionId, sessionId),
        eq(knowledgeNodes.isDeleted, false),
        gte(knowledgeNodes.priorityScore, String(threshold))
      ),
      orderBy: [desc(knowledgeNodes.priorityScore)],
      limit: 50,
    });

    const nodeIds = nodes.map((n) => n.id);

    const edges = await getDb().query.knowledgeEdges.findMany({
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
    if (!getAgeEnabled()) return;

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
    if (!getAgeEnabled()) return;

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
    if (!getAgeEnabled()) {
      throw new Error('AGE is not enabled');
    }
    return ageClientService.findShortestPath(startNodeId, endNodeId);
  },

  /**
   * Find all paths between nodes using Cypher
   */
  async findPaths(startNodeId: string, endNodeId: string, maxHops: number = 5) {
    if (!getAgeEnabled()) {
      throw new Error('AGE is not enabled');
    }
    return ageClientService.findPaths(startNodeId, endNodeId, maxHops);
  },

  /**
   * Get node neighbors using Cypher
   */
  async getNodeNeighbors(nodeId: string, direction: 'in' | 'out' | 'both' = 'both') {
    if (!getAgeEnabled()) {
      throw new Error('AGE is not enabled');
    }
    return ageClientService.getNeighbors(nodeId, direction);
  },

  /**
   * Get session graph from AGE (for visualization)
   */
  async getGraphFromAGE(sessionId: string) {
    if (!getAgeEnabled()) {
      throw new Error('AGE is not enabled');
    }
    return ageClientService.getSessionGraph(sessionId);
  },

  /**
   * Execute custom Cypher query
   */
  async executeCypher<T = Record<string, unknown>>(cypher: string): Promise<T[]> {
    if (!getAgeEnabled()) {
      throw new Error('AGE is not enabled');
    }
    return ageClientService.executeCypher<T>(cypher);
  },

  /**
   * Process domain documentation and create a comprehensive knowledge graph
   * Use this for detailed specifications, requirements documents, etc.
   */
  async processDomainDocumentation(
    sessionId: string,
    documentation: string,
    domainName?: string,
    messageId?: string
  ): Promise<GraphBuildResult> {
    // Extract domain graph using specialized extraction
    const domainGraph = await entityExtractorService.extractDomainKnowledge(documentation, domainName);

    // Get current version
    const latestVersion = await getDb().query.graphVersions.findFirst({
      where: eq(graphVersions.sessionId, sessionId),
      orderBy: [desc(graphVersions.version)],
    });
    const currentVersion = latestVersion?.version || 0;
    const newVersion = currentVersion + 1;

    const nodesAdded: KnowledgeNode[] = [];
    const edgesAdded: KnowledgeEdge[] = [];

    // Create a map from domain node IDs to database node IDs
    const domainIdToDbId = new Map<string, string>();

    // Calculate priority based on domain node type
    const getPriorityForType = (type: string): string => {
      switch (type) {
        case 'Entity':
          return '0.80';
        case 'Process':
          return '0.75';
        case 'Rule':
          return '0.70';
        case 'ProcessStep':
          return '0.65';
        case 'Decision':
          return '0.70';
        case 'Trigger':
          return '0.60';
        case 'Attribute':
          return '0.55';
        case 'Enum':
          return '0.50';
        case 'EnumValue':
          return '0.40';
        case 'Input':
        case 'Output':
          return '0.55';
        case 'Actor':
        case 'System':
          return '0.65';
        case 'Condition':
          return '0.55';
        default:
          return '0.50';
      }
    };

    // Process domain nodes
    for (const domainNode of domainGraph.nodes) {
      const dbId = uuidv4();
      domainIdToDbId.set(domainNode.id, dbId);

      const newNode = {
        id: dbId,
        sessionId,
        nodeType: domainNode.type as NodeType,
        name: domainNode.name,
        graphData: domainNode.properties || {},
        confidenceScore: '0.85', // Domain extraction is high confidence
        priorityScore: getPriorityForType(domainNode.type),
        sourceMessageId: messageId || null,
        version: 1,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await getDb().insert(knowledgeNodes).values(newNode);
      nodesAdded.push(newNode as unknown as KnowledgeNode);

      // Sync to AGE if enabled
      if (getAgeEnabled()) {
        try {
          await ageClientService.createNode(sessionId, domainNode.type, {
            id: dbId,
            domainId: domainNode.id,
            name: domainNode.name,
            ...domainNode.properties,
          });
        } catch (error) {
          console.error('Failed to sync domain node to AGE:', error);
        }
      }
    }

    // Process domain edges
    for (const domainEdge of domainGraph.edges) {
      const sourceDbId = domainIdToDbId.get(domainEdge.from);
      const targetDbId = domainIdToDbId.get(domainEdge.to);

      // Skip if either node doesn't exist
      if (!sourceDbId || !targetDbId) continue;

      const edgeId = uuidv4();
      const newEdge = {
        id: edgeId,
        sessionId,
        sourceNodeId: sourceDbId,
        targetNodeId: targetDbId,
        edgeType: domainEdge.type as EdgeType,
        edgeData: domainEdge.properties || {},
        weight: '1.0',
        isDeleted: false,
        createdAt: new Date(),
      };

      await getDb().insert(knowledgeEdges).values(newEdge);
      edgesAdded.push(newEdge as unknown as KnowledgeEdge);

      // Sync to AGE if enabled
      if (getAgeEnabled()) {
        try {
          await ageClientService.createRelationship(
            sourceDbId,
            targetDbId,
            domainEdge.type,
            domainEdge.properties || {}
          );
        } catch (error) {
          console.error('Failed to sync domain edge to AGE:', error);
        }
      }
    }

    // Create context delta
    const deltaData = {
      additions: {
        nodes: nodesAdded,
        edges: edgesAdded,
      },
      modifications: {
        nodes: [],
        edges: [],
        priorities: [],
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
      triggerMessageId: messageId ?? undefined,
      additions: deltaData.additions,
      modifications: deltaData.modifications,
      removals: deltaData.removals,
      summary: `Domain extraction: Added ${nodesAdded.length} nodes, ${edgesAdded.length} edges from ${domainName || 'documentation'}`,
      statistics: {
        additions: nodesAdded.length + edgesAdded.length,
        modifications: 0,
        removals: 0,
      },
      createdAt: new Date(),
    };

    await getDb().insert(contextDeltas).values({
      id: delta.id,
      sessionId,
      versionFrom: currentVersion,
      versionTo: newVersion,
      triggerMessageId: messageId ?? undefined,
      deltaData,
      createdAt: new Date(),
    });

    // Create graph version snapshot
    const updatedNodes = await getDb().query.knowledgeNodes.findMany({
      where: and(
        eq(knowledgeNodes.sessionId, sessionId),
        eq(knowledgeNodes.isDeleted, false)
      ),
    });
    const updatedEdges = await getDb().query.knowledgeEdges.findMany({
      where: and(
        eq(knowledgeEdges.sessionId, sessionId),
        eq(knowledgeEdges.isDeleted, false)
      ),
    });

    await getDb().insert(graphVersions).values({
      id: uuidv4(),
      sessionId,
      version: newVersion,
      graphSnapshot: {
        sessionId,
        version: newVersion,
        nodes: updatedNodes,
        edges: updatedEdges,
        domainMetadata: domainGraph.metadata,
        createdAt: new Date(),
      },
      createdAt: new Date(),
    });

    console.log(`Domain extraction complete: ${nodesAdded.length} nodes, ${edgesAdded.length} edges`);

    return {
      nodesAdded,
      nodesModified: [],
      nodesRemoved: [],
      edgesAdded,
      edgesModified: [],
      edgesRemoved: [],
      delta,
    };
  },

  /**
   * Smart message processing - uses domain extraction for documentation-like content
   */
  async processMessageSmart(sessionId: string, message: Message): Promise<GraphBuildResult> {
    // Check if content looks like documentation
    if (entityExtractorService.shouldUseDomainExtraction(message.content)) {
      console.log('Detected documentation-like content, using domain extraction');
      return this.processDomainDocumentation(
        sessionId,
        message.content,
        undefined,
        message.id
      );
    }

    // Use regular message processing for conversational content
    return this.processMessage(sessionId, message);
  },

  /**
   * Resolve an entity name to an existing node using multi-strategy matching:
   * 1. Exact name match
   * 2. Alias table lookup
   * 3. LLM-identified aliases from extraction result
   * 4. Levenshtein distance <= 2 for names > 5 chars
   */
  async resolveEntity(
    name: string,
    sessionId: string,
    existingNodes: Array<{ id: string; name: string; nodeType: string; graphData: unknown }>,
    extractionAliases: EntityAlias[]
  ): Promise<{ id: string; name: string; nodeType: string; graphData: unknown } | undefined> {
    const lowerName = name.toLowerCase();

    // 1. Exact name match
    const exactMatch = existingNodes.find(n => n.name.toLowerCase() === lowerName);
    if (exactMatch) return exactMatch;

    // 2. Alias table lookup
    const aliasRows = await getDb().query.nodeAliases.findMany({
      where: and(
        eq(nodeAliases.sessionId, sessionId),
        eq(nodeAliases.alias, lowerName)
      ),
    });
    if (aliasRows.length > 0) {
      const aliasMatch = existingNodes.find(n => n.id === aliasRows[0]!.nodeId);
      if (aliasMatch) return aliasMatch;
    }

    // 3. LLM-identified aliases from extraction result
    for (const alias of extractionAliases) {
      if (alias.canonicalName.toLowerCase() === lowerName) {
        // The name IS the canonical - check if any existing node matches an alias
        for (const alt of alias.aliases) {
          const match = existingNodes.find(n => n.name.toLowerCase() === alt.toLowerCase());
          if (match) return match;
        }
      }
      if (alias.aliases.some(a => a.toLowerCase() === lowerName)) {
        // The name IS an alias - find the canonical
        const match = existingNodes.find(n => n.name.toLowerCase() === alias.canonicalName.toLowerCase());
        if (match) return match;
      }
    }

    // 4. Levenshtein distance <= 2 for names > 5 chars
    if (name.length > 5) {
      for (const node of existingNodes) {
        if (node.name.length > 5 && levenshteinDistance(lowerName, node.name.toLowerCase()) <= 2) {
          return node;
        }
      }
    }

    return undefined;
  },

  /**
   * Process a user+assistant message pair with unified extraction (single LLM call)
   * Replaces the old pattern of 6 separate LLM calls per turn.
   */
  async processMessagePair(
    sessionId: string,
    userMessage: Message,
    assistantMessage: Message
  ): Promise<GraphBuildResult> {
    // Get existing graph
    const existingNodes = await getDb().query.knowledgeNodes.findMany({
      where: and(
        eq(knowledgeNodes.sessionId, sessionId),
        eq(knowledgeNodes.isDeleted, false)
      ),
    });

    const existingEdges = await getDb().query.knowledgeEdges.findMany({
      where: and(
        eq(knowledgeEdges.sessionId, sessionId),
        eq(knowledgeEdges.isDeleted, false)
      ),
    });

    // Get current version
    const latestVersion = await getDb().query.graphVersions.findFirst({
      where: eq(graphVersions.sessionId, sessionId),
      orderBy: [desc(graphVersions.version)],
    });
    const currentVersion = latestVersion?.version || 0;
    const newVersion = currentVersion + 1;

    // Single unified extraction for both messages
    const existingNodeNames = existingNodes.map(n => ({ name: n.name, type: n.nodeType }));
    const extraction = await entityExtractorService.extractUnified(
      userMessage.content,
      assistantMessage.content,
      existingNodeNames
    );

    const nodesAdded: KnowledgeNode[] = [];
    const nodesModified: KnowledgeNode[] = [];
    const edgesAdded: KnowledgeEdge[] = [];

    // Track name -> nodeId for edge resolution
    const nameToNodeId = new Map<string, string>();
    for (const n of existingNodes) {
      nameToNodeId.set(n.name.toLowerCase(), n.id);
    }

    // --- Process Nodes with entity resolution ---
    for (const node of extraction.nodes) {
      const resolved = await this.resolveEntity(
        node.name,
        sessionId,
        existingNodes as Array<{ id: string; name: string; nodeType: string; graphData: unknown }>,
        extraction.entityAliases
      );

      if (resolved) {
        // Update existing node
        const updatedAt = new Date();
        await getDb()
          .update(knowledgeNodes)
          .set({
            graphData: {
              ...(resolved.graphData as Record<string, unknown>),
              ...node.properties,
              description: node.source,
            },
            confidenceScore: String(Math.max(Number((resolved as KnowledgeNode).confidenceScore) || 0, node.confidence)),
            updatedAt,
            version: ((resolved as KnowledgeNode).version || 0) + 1,
          })
          .where(eq(knowledgeNodes.id, resolved.id));

        nodesModified.push({
          ...resolved,
          graphData: { ...(resolved.graphData as Record<string, unknown>), ...node.properties },
          updatedAt,
        } as unknown as KnowledgeNode);

        nameToNodeId.set(node.name.toLowerCase(), resolved.id);
      } else {
        // Create new node
        const nodeType = this.mapWorkflowToNodeType(node.type);
        const priority = nodeType === 'Decision' ? '0.80' : nodeType === 'Intent' ? '0.70' : '0.50';
        const newNode = {
          id: uuidv4(),
          sessionId,
          nodeType: nodeType,
          name: node.name,
          graphData: { ...node.properties, description: node.source },
          confidenceScore: String(node.confidence),
          priorityScore: priority,
          sourceMessageId: userMessage.id,
          version: 1,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await getDb().insert(knowledgeNodes).values(newNode);
        nodesAdded.push(newNode as unknown as KnowledgeNode);
        nameToNodeId.set(node.name.toLowerCase(), newNode.id);
      }
    }

    // --- Process Aliases: populate nodeAliases table ---
    for (const alias of extraction.entityAliases) {
      const canonicalId = nameToNodeId.get(alias.canonicalName.toLowerCase());
      if (!canonicalId) continue;

      for (const alt of alias.aliases) {
        // Check if alias already exists
        const existing = await getDb().query.nodeAliases.findFirst({
          where: and(
            eq(nodeAliases.sessionId, sessionId),
            eq(nodeAliases.nodeId, canonicalId),
            eq(nodeAliases.alias, alt.toLowerCase())
          ),
        });
        if (!existing) {
          await getDb().insert(nodeAliases).values({
            id: uuidv4(),
            sessionId,
            nodeId: canonicalId,
            alias: alt.toLowerCase(),
            createdAt: new Date(),
          });
        }
        // Also register alias in nameToNodeId for edge resolution
        nameToNodeId.set(alt.toLowerCase(), canonicalId);
      }

      // Update graphData.aliases on the node
      const node = [...existingNodes, ...nodesAdded].find(n => n.id === canonicalId);
      if (node) {
        const graphData = (node.graphData as Record<string, unknown>) || {};
        const currentAliases = (graphData.aliases as string[]) || [];
        const newAliases = [...new Set([...currentAliases, ...alias.aliases])];
        await getDb()
          .update(knowledgeNodes)
          .set({ graphData: { ...graphData, aliases: newAliases } })
          .where(eq(knowledgeNodes.id, canonicalId));
      }
    }

    // --- Process Edges with full descriptions (not truncated) ---
    for (const edge of extraction.edges) {
      const sourceId = nameToNodeId.get(edge.from.toLowerCase());
      const targetId = nameToNodeId.get(edge.to.toLowerCase());
      if (!sourceId || !targetId || sourceId === targetId) continue;

      // Check for existing edge
      const exists = existingEdges.some(
        e => e.sourceNodeId === sourceId && e.targetNodeId === targetId && e.edgeType === edge.type
      );
      if (exists) continue;

      const newEdge = {
        id: uuidv4(),
        sessionId,
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        edgeType: edge.type as EdgeType,
        edgeData: { context: edge.source, description: edge.description },
        weight: String(edge.confidence),
        isDeleted: false,
        createdAt: new Date(),
      };

      await getDb().insert(knowledgeEdges).values(newEdge);
      edgesAdded.push(newEdge as unknown as KnowledgeEdge);
    }

    // --- Process Co-occurrences: create/increment CO_OCCURS edges ---
    for (const coOcc of extraction.coOccurrences) {
      const id1 = nameToNodeId.get(coOcc.entity1.toLowerCase());
      const id2 = nameToNodeId.get(coOcc.entity2.toLowerCase());
      if (!id1 || !id2 || id1 === id2) continue;

      // Sort to ensure consistent edge direction
      const [sourceId, targetId] = id1 < id2 ? [id1, id2] : [id2, id1];

      const existingCoOcc = existingEdges.find(
        e => e.sourceNodeId === sourceId && e.targetNodeId === targetId && e.edgeType === 'CO_OCCURS'
      );

      if (existingCoOcc) {
        // Increment weight
        const newWeight = Number(existingCoOcc.weight) + 0.1;
        await getDb()
          .update(knowledgeEdges)
          .set({ weight: String(Math.min(1, newWeight)) })
          .where(eq(knowledgeEdges.id, existingCoOcc.id));
      } else {
        const newEdge = {
          id: uuidv4(),
          sessionId,
          sourceNodeId: sourceId,
          targetNodeId: targetId,
          edgeType: 'CO_OCCURS' as EdgeType,
          edgeData: { context: coOcc.contextSentence },
          weight: '0.3',
          isDeleted: false,
          createdAt: new Date(),
        };

        await getDb().insert(knowledgeEdges).values(newEdge);
        edgesAdded.push(newEdge as unknown as KnowledgeEdge);
      }
    }

    // --- Process Contradictions: create SUPERSEDES edges, reduce superseded node priority ---
    for (const contradiction of extraction.contradictions) {
      const subjectId = nameToNodeId.get(contradiction.subject.toLowerCase());
      if (!subjectId) continue;

      // Find or create a node for the new value
      const newValueName = `${contradiction.subject} (${contradiction.changeType})`;
      let newValueId = nameToNodeId.get(newValueName.toLowerCase());
      if (!newValueId) {
        const newNode = {
          id: uuidv4(),
          sessionId,
          nodeType: 'Concept' as NodeType,
          name: newValueName,
          graphData: {
            previousValue: contradiction.previousValue,
            newValue: contradiction.newValue,
            changeType: contradiction.changeType,
            evidence: contradiction.evidence,
          },
          confidenceScore: '0.85',
          priorityScore: '0.70',
          sourceMessageId: userMessage.id,
          version: 1,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await getDb().insert(knowledgeNodes).values(newNode);
        nodesAdded.push(newNode as unknown as KnowledgeNode);
        newValueId = newNode.id;
        nameToNodeId.set(newValueName.toLowerCase(), newNode.id);
      }

      // Create SUPERSEDES edge
      const supersedesEdge = {
        id: uuidv4(),
        sessionId,
        sourceNodeId: newValueId,
        targetNodeId: subjectId,
        edgeType: 'SUPERSEDES' as EdgeType,
        edgeData: {
          changeType: contradiction.changeType,
          previousValue: contradiction.previousValue,
          newValue: contradiction.newValue,
          evidence: contradiction.evidence,
        },
        weight: '0.9',
        isDeleted: false,
        createdAt: new Date(),
      };
      await getDb().insert(knowledgeEdges).values(supersedesEdge);
      edgesAdded.push(supersedesEdge as unknown as KnowledgeEdge);

      // Reduce superseded node priority
      if (contradiction.changeType === 'supersedes') {
        await getDb()
          .update(knowledgeNodes)
          .set({ priorityScore: '0.20', updatedAt: new Date() })
          .where(eq(knowledgeNodes.id, subjectId));
      }
    }

    // --- Process Reasoning Links: create EVIDENCE_FOR edges ---
    for (const link of extraction.reasoningLinks) {
      const decisionId = nameToNodeId.get(link.decisionName.toLowerCase());
      if (!decisionId) continue;

      for (const evidenceName of link.evidenceList) {
        const evidenceId = nameToNodeId.get(evidenceName.toLowerCase());
        if (!evidenceId || evidenceId === decisionId) continue;

        const evidenceEdge = {
          id: uuidv4(),
          sessionId,
          sourceNodeId: evidenceId,
          targetNodeId: decisionId,
          edgeType: 'EVIDENCE_FOR' as EdgeType,
          edgeData: { rationale: link.rationale },
          weight: '0.85',
          isDeleted: false,
          createdAt: new Date(),
        };
        await getDb().insert(knowledgeEdges).values(evidenceEdge);
        edgesAdded.push(evidenceEdge as unknown as KnowledgeEdge);
      }
    }

    // Recalculate priorities
    const allNodes = [...existingNodes, ...nodesAdded] as KnowledgeNode[];
    const recentMessages = await getDb().query.messages.findMany({
      where: eq(messages.sessionId, sessionId),
      orderBy: [desc(messages.sequenceNumber)],
      limit: 10,
    });

    const priorityUpdates = priorityCalculatorService.recalculate(
      allNodes,
      recentMessages as Message[],
      userMessage.content + '\n' + assistantMessage.content
    );

    for (const update of priorityUpdates) {
      await getDb()
        .update(knowledgeNodes)
        .set({ priorityScore: String(update.newPriority), updatedAt: new Date() })
        .where(eq(knowledgeNodes.id, update.nodeId));
    }

    // Create context delta
    const deltaData = {
      additions: { nodes: nodesAdded, edges: edgesAdded },
      modifications: {
        nodes: nodesModified.map(n => ({
          nodeId: n.id,
          previousData: {},
          newData: n,
          changedFields: ['graphData', 'confidenceScore'],
        })),
        edges: [],
        priorities: priorityUpdates,
      },
      removals: { nodeIds: [], edgeIds: [] },
    };

    const delta: ContextDelta = {
      id: uuidv4(),
      sessionId,
      versionFrom: currentVersion,
      versionTo: newVersion,
      triggerMessageId: userMessage.id,
      additions: deltaData.additions,
      modifications: deltaData.modifications,
      removals: deltaData.removals,
      summary: `Unified: +${nodesAdded.length} nodes, ~${nodesModified.length} modified, +${edgesAdded.length} edges`,
      statistics: {
        additions: nodesAdded.length + edgesAdded.length,
        modifications: nodesModified.length + priorityUpdates.length,
        removals: 0,
      },
      createdAt: new Date(),
    };

    await getDb().insert(contextDeltas).values({
      id: delta.id,
      sessionId,
      versionFrom: currentVersion,
      versionTo: newVersion,
      triggerMessageId: userMessage.id,
      deltaData,
      createdAt: new Date(),
    });

    // Create graph version snapshot
    const updatedNodes = await getDb().query.knowledgeNodes.findMany({
      where: and(eq(knowledgeNodes.sessionId, sessionId), eq(knowledgeNodes.isDeleted, false)),
    });
    const updatedEdges = await getDb().query.knowledgeEdges.findMany({
      where: and(eq(knowledgeEdges.sessionId, sessionId), eq(knowledgeEdges.isDeleted, false)),
    });

    await getDb().insert(graphVersions).values({
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

    console.log(`Unified extraction: +${nodesAdded.length} nodes, ~${nodesModified.length} modified, +${edgesAdded.length} edges (1 LLM call)`);

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
   * Map workflow node types to legacy NodeType values
   */
  mapWorkflowToNodeType(workflowType: string): NodeType {
    switch (workflowType) {
      case 'Goal':
      case 'Task':
        return 'Intent' as NodeType;
      case 'Decision':
        return 'Decision' as NodeType;
      case 'Constraint':
      case 'Fact':
        return 'Concept' as NodeType;
      case 'Resource':
        return 'Entity' as NodeType;
      case 'State':
        return 'Event' as NodeType;
      default:
        return 'Concept' as NodeType;
    }
  },

  /**
   * Repair orphan nodes by using an LLM call to identify which orphans
   * relate to which connected nodes, then creating CO_OCCURS edges.
   */
  async repairOrphans(sessionId: string): Promise<{ edgesCreated: number; orphansConnected: number }> {
    const allNodes = await getDb().query.knowledgeNodes.findMany({
      where: and(
        eq(knowledgeNodes.sessionId, sessionId),
        eq(knowledgeNodes.isDeleted, false)
      ),
    });

    const allEdges = await getDb().query.knowledgeEdges.findMany({
      where: and(
        eq(knowledgeEdges.sessionId, sessionId),
        eq(knowledgeEdges.isDeleted, false)
      ),
    });

    // Find orphan nodes (no edges at all)
    const connectedNodeIds = new Set<string>();
    for (const edge of allEdges) {
      connectedNodeIds.add(edge.sourceNodeId);
      connectedNodeIds.add(edge.targetNodeId);
    }
    const orphanNodes = allNodes.filter(n => !connectedNodeIds.has(n.id));
    const connectedNodes = allNodes.filter(n => connectedNodeIds.has(n.id));

    if (orphanNodes.length === 0) {
      return { edgesCreated: 0, orphansConnected: 0 };
    }

    console.log(`Repairing ${orphanNodes.length} orphan nodes for session ${sessionId}`);

    // Ask LLM to match orphans to connected nodes
    const orphanList = orphanNodes.map(n => `- "${n.name}" (${n.nodeType})`).join('\n');
    const connectedList = connectedNodes.map(n => `- "${n.name}" (${n.nodeType})`).join('\n');

    const prompt = `You are analyzing a knowledge graph that has orphan nodes (not connected to anything).
Match each orphan to the most semantically related connected node(s).

ORPHAN NODES:
${orphanList}

CONNECTED NODES:
${connectedList}

For each orphan, output which connected node(s) it should be linked to.
Return JSON array:
[
  { "orphan": "exact orphan name", "targets": ["exact connected node name", ...], "reason": "brief reason" }
]

Rules:
- Every orphan MUST have at least one target
- Only use exact names from the lists above
- Match based on semantic relatedness (same domain concept, part of same workflow, etc.)
- Return ONLY the JSON array, no other text`;

    try {
      const { claudeClientService } = await import('../llm/claude-client.service.js');
      const response = await claudeClientService.createCompletion({
        systemPrompt: 'You are a knowledge graph repair system. Output only valid JSON.',
        messages: [{ role: 'user', content: prompt }],
        relevantNodes: [],
        relevantEdges: [],
      });

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('Orphan repair: no JSON in LLM response');
        return { edgesCreated: 0, orphansConnected: 0 };
      }

      const matches = JSON.parse(jsonMatch[0]) as Array<{
        orphan: string;
        targets: string[];
        reason: string;
      }>;

      // Build name -> id map
      const nameToId = new Map<string, string>();
      for (const n of allNodes) {
        nameToId.set(n.name.toLowerCase(), n.id);
      }

      let edgesCreated = 0;
      const orphansConnected = new Set<string>();

      for (const match of matches) {
        const orphanId = nameToId.get(match.orphan.toLowerCase());
        if (!orphanId) continue;

        for (const targetName of match.targets) {
          const targetId = nameToId.get(targetName.toLowerCase());
          if (!targetId || targetId === orphanId) continue;

          // Check edge doesn't already exist
          const exists = allEdges.some(
            e => (e.sourceNodeId === orphanId && e.targetNodeId === targetId) ||
                 (e.sourceNodeId === targetId && e.targetNodeId === orphanId)
          );
          if (exists) continue;

          const [sourceId, destId] = orphanId < targetId ? [orphanId, targetId] : [targetId, orphanId];

          await getDb().insert(knowledgeEdges).values({
            id: uuidv4(),
            sessionId,
            sourceNodeId: sourceId,
            targetNodeId: destId,
            edgeType: 'RELATES_TO' as EdgeType,
            edgeData: { context: match.reason, repairedOrphan: true },
            weight: '0.5',
            isDeleted: false,
            createdAt: new Date(),
          });

          edgesCreated++;
          orphansConnected.add(orphanId);
        }
      }

      console.log(`Orphan repair complete: ${edgesCreated} edges created, ${orphansConnected.size} orphans connected`);
      return { edgesCreated, orphansConnected: orphansConnected.size };
    } catch (error) {
      console.error('Orphan repair failed:', error);
      return { edgesCreated: 0, orphansConnected: 0 };
    }
  },
};
