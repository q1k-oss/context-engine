/**
 * Domain Knowledge Graph Schema
 * For extracting rich domain models from documentation/specifications
 */

// =============================================================================
// NODE TYPES - Domain modeling elements
// =============================================================================

export const DomainNodeTypes = {
  /** A business/domain entity (e.g., PURCHASE_ORDER, LINE_ITEM) */
  ENTITY: 'Entity',
  /** An attribute/property of an entity */
  ATTRIBUTE: 'Attribute',
  /** A workflow or process with multiple steps */
  PROCESS: 'Process',
  /** A single step within a process */
  PROCESS_STEP: 'ProcessStep',
  /** A business rule or constraint */
  RULE: 'Rule',
  /** An enumeration/allowed values */
  ENUM: 'Enum',
  /** An enum value */
  ENUM_VALUE: 'EnumValue',
  /** A user role or actor */
  ACTOR: 'Actor',
  /** An external system or integration */
  SYSTEM: 'System',
  /** A trigger that starts a process */
  TRIGGER: 'Trigger',
  /** Input required for a process */
  INPUT: 'Input',
  /** Output produced by a process */
  OUTPUT: 'Output',
  /** A decision point in a process */
  DECISION: 'Decision',
  /** A condition/criteria */
  CONDITION: 'Condition',
} as const;

export type DomainNodeType = (typeof DomainNodeTypes)[keyof typeof DomainNodeTypes];

// =============================================================================
// EDGE TYPES - Domain relationships
// =============================================================================

export const DomainEdgeTypes = {
  /** Entity has an attribute */
  HAS_ATTRIBUTE: 'HAS_ATTRIBUTE',
  /** Entity references another entity (FK relationship) */
  REFERENCES: 'REFERENCES',
  /** Entity contains other entities (composition) */
  CONTAINS: 'CONTAINS',
  /** One-to-many relationship */
  HAS_MANY: 'HAS_MANY',
  /** Many-to-one relationship */
  BELONGS_TO: 'BELONGS_TO',
  /** Attribute uses an enum type */
  HAS_TYPE: 'HAS_TYPE',
  /** Enum has values */
  HAS_VALUE: 'HAS_VALUE',
  /** Process has a step */
  HAS_STEP: 'HAS_STEP',
  /** Step follows another step */
  NEXT_STEP: 'NEXT_STEP',
  /** Process is triggered by */
  TRIGGERED_BY: 'TRIGGERED_BY',
  /** Process requires input */
  REQUIRES_INPUT: 'REQUIRES_INPUT',
  /** Process produces output */
  PRODUCES_OUTPUT: 'PRODUCES_OUTPUT',
  /** Step creates/modifies entity */
  AFFECTS: 'AFFECTS',
  /** Rule constrains entity/attribute */
  CONSTRAINS: 'CONSTRAINS',
  /** Decision leads to different paths */
  BRANCHES_TO: 'BRANCHES_TO',
  /** Condition triggers action */
  WHEN: 'WHEN',
  /** Actor performs process */
  PERFORMS: 'PERFORMS',
  /** System integrates with */
  INTEGRATES_WITH: 'INTEGRATES_WITH',
  /** Entity inherits from another */
  EXTENDS: 'EXTENDS',
  /** Process calls sub-process */
  CALLS: 'CALLS',
} as const;

export type DomainEdgeType = (typeof DomainEdgeTypes)[keyof typeof DomainEdgeTypes];

// =============================================================================
// VALID RELATIONSHIPS
// =============================================================================

export const DomainValidRelationships: Record<DomainEdgeType, { from: DomainNodeType[]; to: DomainNodeType[] }> = {
  HAS_ATTRIBUTE: { from: ['Entity'], to: ['Attribute'] },
  REFERENCES: { from: ['Entity', 'Attribute'], to: ['Entity'] },
  CONTAINS: { from: ['Entity'], to: ['Entity'] },
  HAS_MANY: { from: ['Entity'], to: ['Entity'] },
  BELONGS_TO: { from: ['Entity'], to: ['Entity'] },
  HAS_TYPE: { from: ['Attribute'], to: ['Enum', 'Entity'] },
  HAS_VALUE: { from: ['Enum'], to: ['EnumValue'] },
  HAS_STEP: { from: ['Process'], to: ['ProcessStep'] },
  NEXT_STEP: { from: ['ProcessStep'], to: ['ProcessStep', 'Decision'] },
  TRIGGERED_BY: { from: ['Process'], to: ['Trigger'] },
  REQUIRES_INPUT: { from: ['Process', 'ProcessStep'], to: ['Input', 'Entity'] },
  PRODUCES_OUTPUT: { from: ['Process', 'ProcessStep'], to: ['Output', 'Entity'] },
  AFFECTS: { from: ['ProcessStep'], to: ['Entity', 'Attribute'] },
  CONSTRAINS: { from: ['Rule'], to: ['Entity', 'Attribute', 'Process'] },
  BRANCHES_TO: { from: ['Decision'], to: ['ProcessStep', 'Process'] },
  WHEN: { from: ['Condition'], to: ['ProcessStep', 'Rule'] },
  PERFORMS: { from: ['Actor'], to: ['Process'] },
  INTEGRATES_WITH: { from: ['System', 'Process'], to: ['System'] },
  EXTENDS: { from: ['Entity'], to: ['Entity'] },
  CALLS: { from: ['Process', 'ProcessStep'], to: ['Process'] },
};

// =============================================================================
// DOMAIN EXTRACTION PROMPT
// =============================================================================

export const DomainExtractionPrompt = `You are a domain modeling expert. Extract a comprehensive knowledge graph from the provided documentation.

EXTRACTION RULES:
1. Extract ALL entities mentioned (business objects, data structures)
2. Extract ALL attributes for each entity
3. Extract ALL processes/workflows with their steps
4. Extract ALL business rules and constraints
5. Extract ALL relationships between entities
6. Extract ALL enumerations and their values
7. Include cardinality for relationships (1:1, 1:N, N:M)

NODE TYPES:
- Entity: Business objects (e.g., PURCHASE_ORDER, LINE_ITEM, WAREHOUSE)
- Attribute: Properties of entities (e.g., po_number: string, quantity: integer)
- Process: Named workflows (e.g., PROCESS_PO, UPDATE_FULFILLMENT)
- ProcessStep: Individual steps in a process (e.g., "Validate Upload", "Match SKUs")
- Rule: Business rules/constraints (e.g., "Delivery cannot exceed fulfillment")
- Enum: Enumeration types (e.g., PO_STATUS, MATCH_TYPE)
- EnumValue: Values in an enum (e.g., NEW, PENDING, COMPLETED)
- Actor: Users or roles (e.g., "Operations Team")
- System: External systems (e.g., "Google Sheets", "Amazon")
- Trigger: What starts a process (e.g., "User uploads file")
- Input: Required inputs (e.g., "Amazon PO file")
- Output: Produced outputs (e.g., "Sales Order CSV")
- Decision: Branch points (e.g., "If duplicates found")
- Condition: Criteria for decisions (e.g., "address contains 'Saudi'")

EDGE TYPES:
- HAS_ATTRIBUTE: Entity → Attribute
- REFERENCES: Entity → Entity (foreign key)
- CONTAINS: Entity → Entity (composition, 1:N)
- HAS_MANY: Entity → Entity (1:N relationship)
- BELONGS_TO: Entity → Entity (N:1 relationship)
- HAS_TYPE: Attribute → Enum/Entity
- HAS_VALUE: Enum → EnumValue
- HAS_STEP: Process → ProcessStep
- NEXT_STEP: ProcessStep → ProcessStep (sequence)
- TRIGGERED_BY: Process → Trigger
- REQUIRES_INPUT: Process/Step → Input/Entity
- PRODUCES_OUTPUT: Process/Step → Output/Entity
- AFFECTS: ProcessStep → Entity (creates/modifies)
- CONSTRAINS: Rule → Entity/Attribute/Process
- BRANCHES_TO: Decision → ProcessStep/Process
- WHEN: Condition → ProcessStep/Rule
- PERFORMS: Actor → Process

OUTPUT FORMAT (JSON):
{
  "nodes": [
    {
      "id": "unique_id",
      "name": "Display Name",
      "type": "Entity|Attribute|Process|...",
      "properties": {
        "dataType": "string|integer|...",
        "isPrimaryKey": true|false,
        "isForeignKey": true|false,
        "isRequired": true|false,
        "cardinality": "1:1|1:N|N:M",
        "description": "What this represents",
        "formula": "calculation if derived",
        "sequence": 1  // for process steps
      }
    }
  ],
  "edges": [
    {
      "from": "source_node_id",
      "to": "target_node_id",
      "type": "HAS_ATTRIBUTE|REFERENCES|...",
      "properties": {
        "cardinality": "1:N",
        "label": "optional edge label"
      }
    }
  ]
}

IMPORTANT:
- Use consistent IDs (e.g., "entity_purchase_order", "attr_po_number", "process_process_po")
- Extract EVERYTHING - more detail is better
- Include process flow with NEXT_STEP relationships
- Include all business rules as Rule nodes with CONSTRAINS edges
- For enums, create the Enum node AND all EnumValue nodes`;

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface DomainNode {
  id: string;
  name: string;
  type: DomainNodeType;
  properties?: {
    dataType?: string;
    isPrimaryKey?: boolean;
    isForeignKey?: boolean;
    isRequired?: boolean;
    cardinality?: '1:1' | '1:N' | 'N:1' | 'N:M';
    description?: string;
    formula?: string;
    sequence?: number;
    defaultValue?: string;
    allowedValues?: string[];
  };
}

export interface DomainEdge {
  from: string;
  to: string;
  type: DomainEdgeType;
  properties?: {
    cardinality?: string;
    label?: string;
    condition?: string;
  };
}

export interface DomainGraph {
  nodes: DomainNode[];
  edges: DomainEdge[];
  metadata?: {
    domain: string;
    extractedAt: Date;
    version: string;
  };
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

export function isDomainNodeType(type: string): type is DomainNodeType {
  return Object.values(DomainNodeTypes).includes(type as DomainNodeType);
}

export function isDomainEdgeType(type: string): type is DomainEdgeType {
  return Object.values(DomainEdgeTypes).includes(type as DomainEdgeType);
}

export function isValidDomainRelationship(
  edgeType: DomainEdgeType,
  fromType: DomainNodeType,
  toType: DomainNodeType
): boolean {
  const valid = DomainValidRelationships[edgeType];
  if (!valid) return false;
  return valid.from.includes(fromType) && valid.to.includes(toType);
}
