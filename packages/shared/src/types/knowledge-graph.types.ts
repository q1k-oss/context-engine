/**
 * Node Types in the Knowledge Graph
 */
export const NodeType = {
  Entity: 'Entity',
  Concept: 'Concept',
  Event: 'Event',
  Intent: 'Intent',
  Decision: 'Decision',
  Artifact: 'Artifact',
} as const;

export type NodeType = (typeof NodeType)[keyof typeof NodeType];

/**
 * Edge Types representing relationships between nodes
 */
export const EdgeType = {
  RelatesTo: 'RELATES_TO',
  Causes: 'CAUSES',
  DependsOn: 'DEPENDS_ON',
  DecidedBy: 'DECIDED_BY',
  ConstrainedBy: 'CONSTRAINED_BY',
  DerivedFrom: 'DERIVED_FROM',
  TemporallyPrecedes: 'TEMPORALLY_PRECEDES',
} as const;

export type EdgeType = (typeof EdgeType)[keyof typeof EdgeType];

/**
 * Flexible graph data stored as JSONB
 */
export interface GraphData {
  description?: string;
  aliases?: string[];
  properties?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Knowledge Node representing an entity, concept, event, etc.
 */
export interface KnowledgeNode {
  id: string;
  sessionId: string;
  nodeType: NodeType;
  name: string;
  graphData: GraphData;
  confidenceScore: number;
  priorityScore: number;
  sourceMessageId?: string;
  version: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Edge data stored as JSONB
 */
export interface EdgeData {
  context?: string;
  strength?: number;
  properties?: Record<string, unknown>;
}

/**
 * Knowledge Edge representing a relationship between two nodes
 */
export interface KnowledgeEdge {
  id: string;
  sessionId: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: EdgeType;
  edgeData: EdgeData;
  weight: number;
  isDeleted: boolean;
  createdAt: Date;
}

/**
 * Complete knowledge graph for a session
 */
export interface KnowledgeGraph {
  sessionId: string;
  version: number;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  createdAt: Date;
}

/**
 * Delta tracking additions to the graph
 */
export interface GraphAdditions {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

/**
 * Node modification tracking
 */
export interface NodeModification {
  nodeId: string;
  previousData: Partial<KnowledgeNode>;
  newData: Partial<KnowledgeNode>;
  changedFields: string[];
}

/**
 * Priority change tracking
 */
export interface PriorityChange {
  nodeId: string;
  previousPriority: number;
  newPriority: number;
  reason?: string;
}

/**
 * Delta tracking modifications to the graph
 */
export interface GraphModifications {
  nodes: NodeModification[];
  edges: Array<{
    edgeId: string;
    previousData: Partial<KnowledgeEdge>;
    newData: Partial<KnowledgeEdge>;
  }>;
  priorities: PriorityChange[];
}

/**
 * Delta tracking removals from the graph
 */
export interface GraphRemovals {
  nodeIds: string[];
  edgeIds: string[];
}

/**
 * Context delta representing changes between graph versions
 */
export interface ContextDelta {
  id: string;
  sessionId: string;
  versionFrom: number;
  versionTo: number;
  triggerMessageId?: string;
  additions: GraphAdditions;
  modifications: GraphModifications;
  removals: GraphRemovals;
  summary: string;
  statistics: {
    additions: number;
    modifications: number;
    removals: number;
  };
  createdAt: Date;
}

/**
 * Graph version snapshot
 */
export interface GraphVersion {
  id: string;
  sessionId: string;
  version: number;
  graphSnapshot: KnowledgeGraph;
  createdAt: Date;
}

/**
 * Extraction result from entity extractor
 */
export interface ExtractionResult {
  entities: Array<{
    name: string;
    confidence: number;
    properties: Record<string, unknown>;
  }>;
  concepts: Array<{
    name: string;
    confidence: number;
    properties: Record<string, unknown>;
  }>;
  events: Array<{
    name: string;
    confidence: number;
    properties: Record<string, unknown>;
  }>;
  intents: Array<{
    name: string;
    confidence: number;
    properties: Record<string, unknown>;
  }>;
  decisions: Array<{
    name: string;
    confidence: number;
    properties: Record<string, unknown>;
  }>;
  artifacts: Array<{
    name: string;
    confidence: number;
    properties: Record<string, unknown>;
  }>;
}

/**
 * Graph builder processing result
 */
export interface GraphBuildResult {
  nodesAdded: KnowledgeNode[];
  nodesModified: KnowledgeNode[];
  nodesRemoved: string[];
  edgesAdded: KnowledgeEdge[];
  edgesModified: KnowledgeEdge[];
  edgesRemoved: string[];
  delta: ContextDelta;
}
