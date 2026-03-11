export const NodeType = {
  Entity: 'Entity',
  Concept: 'Concept',
  Event: 'Event',
  Intent: 'Intent',
  Decision: 'Decision',
  Artifact: 'Artifact',
} as const;

export type NodeType = (typeof NodeType)[keyof typeof NodeType];

export const EdgeType = {
  RelatesTo: 'RELATES_TO',
  Causes: 'CAUSES',
  DependsOn: 'DEPENDS_ON',
  DecidedBy: 'DECIDED_BY',
  ConstrainedBy: 'CONSTRAINED_BY',
  DerivedFrom: 'DERIVED_FROM',
  TemporallyPrecedes: 'TEMPORALLY_PRECEDES',
  CoOccurs: 'CO_OCCURS',
  Supersedes: 'SUPERSEDES',
  EvidenceFor: 'EVIDENCE_FOR',
} as const;

export type EdgeType = (typeof EdgeType)[keyof typeof EdgeType];

export interface GraphData {
  description?: string;
  aliases?: string[];
  properties?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeNode {
  id: string;
  sessionId: string;
  nodeType: NodeType;
  name: string;
  graphData: GraphData;
  confidenceScore: number | string;
  priorityScore: number | string;
  sourceMessageId?: string;
  version: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EdgeData {
  context?: string;
  strength?: number;
  properties?: Record<string, unknown>;
}

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

export interface KnowledgeGraph {
  sessionId: string;
  version: number;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  createdAt: Date;
}

export interface GraphAdditions {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

export interface NodeModification {
  nodeId: string;
  previousData: Partial<KnowledgeNode>;
  newData: Partial<KnowledgeNode>;
  changedFields: string[];
}

export interface PriorityChange {
  nodeId: string;
  previousPriority: number;
  newPriority: number;
  reason?: string;
}

export interface GraphModifications {
  nodes: NodeModification[];
  edges: Array<{
    edgeId: string;
    previousData: Partial<KnowledgeEdge>;
    newData: Partial<KnowledgeEdge>;
  }>;
  priorities: PriorityChange[];
}

export interface GraphRemovals {
  nodeIds: string[];
  edgeIds: string[];
}

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

export interface GraphVersion {
  id: string;
  sessionId: string;
  version: number;
  graphSnapshot: KnowledgeGraph;
  createdAt: Date;
}

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

export interface GraphBuildResult {
  nodesAdded: KnowledgeNode[];
  nodesModified: KnowledgeNode[];
  nodesRemoved: string[];
  edgesAdded: KnowledgeEdge[];
  edgesModified: KnowledgeEdge[];
  edgesRemoved: string[];
  delta: ContextDelta;
}
