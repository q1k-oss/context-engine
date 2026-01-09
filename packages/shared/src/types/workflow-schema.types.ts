/**
 * Workflow-Based AI Agent Schema
 * Conservative extraction for building accurate context graphs
 */

// =============================================================================
// NODE TYPES - What we track in the workflow
// =============================================================================

export const WorkflowNodeTypes = {
  /** User's high-level objective or desired outcome */
  GOAL: 'Goal',
  /** Specific actionable item to be completed */
  TASK: 'Task',
  /** A choice or determination made during conversation */
  DECISION: 'Decision',
  /** Limitation, rule, or requirement that must be respected */
  CONSTRAINT: 'Constraint',
  /** Key object, system, tool, or resource involved */
  RESOURCE: 'Resource',
  /** A specific piece of information or data point */
  FACT: 'Fact',
  /** Current status or condition of something */
  STATE: 'State',
} as const;

export type WorkflowNodeType = (typeof WorkflowNodeTypes)[keyof typeof WorkflowNodeTypes];

// =============================================================================
// EDGE TYPES - How nodes relate to each other
// =============================================================================

export const WorkflowEdgeTypes = {
  /** Task contributes to achieving a Goal */
  ACHIEVES: 'ACHIEVES',
  /** One task/goal requires another to be completed first */
  REQUIRES: 'REQUIRES',
  /** Constraint blocks or limits a task/goal */
  BLOCKS: 'BLOCKS',
  /** Decision determines the direction of a task/goal */
  DECIDES: 'DECIDES',
  /** Task/Goal involves using a resource */
  USES: 'USES',
  /** Fact supports or validates a decision/task */
  SUPPORTS: 'SUPPORTS',
  /** One item is part of another (decomposition) */
  PART_OF: 'PART_OF',
  /** State describes current condition of task/goal */
  HAS_STATE: 'HAS_STATE',
} as const;

export type WorkflowEdgeType = (typeof WorkflowEdgeTypes)[keyof typeof WorkflowEdgeTypes];

// =============================================================================
// VALID RELATIONSHIPS - Constrain which edges can connect which nodes
// =============================================================================

export const ValidRelationships: Record<WorkflowEdgeType, { from: WorkflowNodeType[]; to: WorkflowNodeType[] }> = {
  ACHIEVES: {
    from: ['Task'],
    to: ['Goal'],
  },
  REQUIRES: {
    from: ['Task', 'Goal'],
    to: ['Task', 'Resource', 'Decision'],
  },
  BLOCKS: {
    from: ['Constraint'],
    to: ['Task', 'Goal'],
  },
  DECIDES: {
    from: ['Decision'],
    to: ['Task', 'Goal'],
  },
  USES: {
    from: ['Task'],
    to: ['Resource'],
  },
  SUPPORTS: {
    from: ['Fact'],
    to: ['Decision', 'Task', 'Goal'],
  },
  PART_OF: {
    from: ['Task', 'Goal'],
    to: ['Task', 'Goal'],
  },
  HAS_STATE: {
    from: ['Task', 'Goal'],
    to: ['State'],
  },
};

// =============================================================================
// EXTRACTION RULES - Conservative extraction guidelines
// =============================================================================

export const ExtractionConfig = {
  /** Minimum confidence score to accept an extraction */
  minConfidence: 0.7,

  /** Minimum confidence for relationships */
  minRelationshipConfidence: 0.75,

  /** Only extract items that are explicitly stated */
  requireExplicit: true,

  /** Maximum entities to extract per message */
  maxEntitiesPerMessage: 5,

  /** Maximum relationships to extract per message */
  maxRelationshipsPerMessage: 5,
} as const;

// =============================================================================
// EXTRACTION MARKERS - Keywords that signal specific node types
// =============================================================================

export const ExtractionMarkers: Record<WorkflowNodeType, string[]> = {
  Goal: [
    'i want to',
    'i need to',
    'goal is',
    'objective is',
    'trying to',
    'aim to',
    'purpose is',
    'end goal',
    'ultimate goal',
    'want to achieve',
  ],
  Task: [
    'need to do',
    'should do',
    'must do',
    'action item',
    'step is',
    'to-do',
    'task is',
    'work on',
    'implement',
    'create',
    'build',
    'fix',
    'update',
  ],
  Decision: [
    'decided to',
    'decision is',
    'chose to',
    'will use',
    'going with',
    'selected',
    'picked',
    'settled on',
    'determined',
  ],
  Constraint: [
    'must not',
    'cannot',
    'limitation',
    'constraint',
    'requirement is',
    'restricted to',
    'only allowed',
    'must be',
    'should not',
    'avoid',
  ],
  Resource: [
    'using',
    'tool is',
    'library',
    'framework',
    'database',
    'api',
    'service',
    'system',
    'platform',
    'technology',
  ],
  Fact: [
    'fact is',
    'know that',
    'confirmed',
    'verified',
    'true that',
    'found out',
    'discovered',
    'realized',
  ],
  State: [
    'currently',
    'status is',
    'state is',
    'right now',
    'at the moment',
    'progress is',
    'completed',
    'pending',
    'blocked',
    'in progress',
  ],
};

// =============================================================================
// EXTRACTION PROMPT TEMPLATE
// =============================================================================

export const WorkflowExtractionPrompt = `You are a precise context extraction system for a workflow-based AI agent.

TASK: Extract structured information from the conversation to build an accurate knowledge graph.

RULES (STRICT):
1. Only extract items that are EXPLICITLY stated - never infer or assume
2. Each extraction must have confidence >= 0.7 to be included
3. If uncertain, do NOT include the item
4. Focus on actionable, workflow-relevant information
5. Avoid generic or vague extractions

NODE TYPES TO EXTRACT:
- Goal: User's explicit objectives (e.g., "I want to build X", "My goal is Y")
- Task: Specific action items (e.g., "I need to implement X", "Next step is Y")
- Decision: Explicit choices made (e.g., "I've decided to use X", "Going with Y")
- Constraint: Stated limitations (e.g., "Must not exceed X", "Cannot use Y")
- Resource: Tools/systems mentioned for use (e.g., "Using PostgreSQL", "Will use React")
- Fact: Verified information (e.g., "The API returns X", "Database has Y")
- State: Current status (e.g., "Currently blocked on X", "Y is complete")

EDGE TYPES (only use these):
- ACHIEVES: Task -> Goal (task helps achieve goal)
- REQUIRES: Task/Goal -> Task/Resource/Decision (prerequisite)
- BLOCKS: Constraint -> Task/Goal (prevents progress)
- DECIDES: Decision -> Task/Goal (determines direction)
- USES: Task -> Resource (task uses a resource)
- SUPPORTS: Fact -> Decision/Task/Goal (evidence)
- PART_OF: Task/Goal -> Task/Goal (decomposition)
- HAS_STATE: Task/Goal -> State (current status)

OUTPUT FORMAT (JSON only):
{
  "nodes": [
    {
      "name": "exact name from conversation",
      "type": "Goal|Task|Decision|Constraint|Resource|Fact|State",
      "confidence": 0.0-1.0,
      "source": "quote from message that supports this extraction"
    }
  ],
  "edges": [
    {
      "from": "source node name",
      "to": "target node name",
      "type": "ACHIEVES|REQUIRES|BLOCKS|DECIDES|USES|SUPPORTS|PART_OF|HAS_STATE",
      "confidence": 0.0-1.0,
      "source": "quote that shows this relationship"
    }
  ]
}

IMPORTANT:
- Include "source" field with exact quote from the message
- If no confident extractions, return {"nodes": [], "edges": []}
- Quality over quantity - fewer accurate extractions is better`;

// =============================================================================
// TYPE DEFINITIONS FOR EXTRACTION RESULTS
// =============================================================================

export interface ExtractedNode {
  name: string;
  type: WorkflowNodeType;
  confidence: number;
  source: string; // Quote from message
  properties?: Record<string, unknown>;
}

export interface ExtractedEdge {
  from: string;
  to: string;
  type: WorkflowEdgeType;
  confidence: number;
  source: string; // Quote showing relationship
}

export interface WorkflowExtractionResult {
  nodes: ExtractedNode[];
  edges: ExtractedEdge[];
  messageId?: string;
  timestamp?: Date;
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

export function isValidNodeType(type: string): type is WorkflowNodeType {
  return Object.values(WorkflowNodeTypes).includes(type as WorkflowNodeType);
}

export function isValidEdgeType(type: string): type is WorkflowEdgeType {
  return Object.values(WorkflowEdgeTypes).includes(type as WorkflowEdgeType);
}

export function isValidRelationship(
  edgeType: WorkflowEdgeType,
  fromType: WorkflowNodeType,
  toType: WorkflowNodeType
): boolean {
  const valid = ValidRelationships[edgeType];
  if (!valid) return false;
  return valid.from.includes(fromType) && valid.to.includes(toType);
}

export function meetsConfidenceThreshold(confidence: number, isEdge: boolean = false): boolean {
  const threshold = isEdge
    ? ExtractionConfig.minRelationshipConfidence
    : ExtractionConfig.minConfidence;
  return confidence >= threshold;
}
