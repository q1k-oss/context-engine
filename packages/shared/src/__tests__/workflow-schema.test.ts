import { describe, it, expect } from 'vitest';
import {
  isValidNodeType,
  isValidEdgeType,
  isValidRelationship,
  meetsConfidenceThreshold,
  ExtractionConfig,
  WorkflowNodeTypes,
  WorkflowEdgeTypes,
  ValidRelationships,
} from '../types/workflow-schema.types.js';

describe('isValidNodeType', () => {
  it('accepts all valid node types', () => {
    for (const type of Object.values(WorkflowNodeTypes)) {
      expect(isValidNodeType(type)).toBe(true);
    }
  });

  it('rejects invalid node types', () => {
    expect(isValidNodeType('InvalidType')).toBe(false);
    expect(isValidNodeType('')).toBe(false);
    expect(isValidNodeType('entity')).toBe(false); // case-sensitive
    expect(isValidNodeType('goal')).toBe(false);
  });
});

describe('isValidEdgeType', () => {
  it('accepts all valid edge types', () => {
    for (const type of Object.values(WorkflowEdgeTypes)) {
      expect(isValidEdgeType(type)).toBe(true);
    }
  });

  it('rejects invalid edge types', () => {
    expect(isValidEdgeType('INVALID')).toBe(false);
    expect(isValidEdgeType('')).toBe(false);
    expect(isValidEdgeType('achieves')).toBe(false); // case-sensitive
  });
});

describe('isValidRelationship', () => {
  it('ACHIEVES: Task -> Goal is valid', () => {
    expect(isValidRelationship('ACHIEVES', 'Task', 'Goal')).toBe(true);
  });

  it('ACHIEVES: Goal -> Task is invalid', () => {
    expect(isValidRelationship('ACHIEVES', 'Goal', 'Task')).toBe(false);
  });

  it('REQUIRES: Task -> Resource is valid', () => {
    expect(isValidRelationship('REQUIRES', 'Task', 'Resource')).toBe(true);
  });

  it('REQUIRES: Goal -> Decision is valid', () => {
    expect(isValidRelationship('REQUIRES', 'Goal', 'Decision')).toBe(true);
  });

  it('BLOCKS: Constraint -> Task is valid', () => {
    expect(isValidRelationship('BLOCKS', 'Constraint', 'Task')).toBe(true);
  });

  it('BLOCKS: Task -> Constraint is invalid', () => {
    expect(isValidRelationship('BLOCKS', 'Task', 'Constraint')).toBe(false);
  });

  it('USES: Task -> Resource is valid', () => {
    expect(isValidRelationship('USES', 'Task', 'Resource')).toBe(true);
  });

  it('DECIDES: Decision -> Goal is valid', () => {
    expect(isValidRelationship('DECIDES', 'Decision', 'Goal')).toBe(true);
  });

  it('SUPPORTS: Fact -> Decision is valid', () => {
    expect(isValidRelationship('SUPPORTS', 'Fact', 'Decision')).toBe(true);
  });

  it('PART_OF: Task -> Goal is valid', () => {
    expect(isValidRelationship('PART_OF', 'Task', 'Goal')).toBe(true);
  });

  it('HAS_STATE: Task -> State is valid', () => {
    expect(isValidRelationship('HAS_STATE', 'Task', 'State')).toBe(true);
  });

  it('validates all defined relationships', () => {
    for (const [edgeType, rule] of Object.entries(ValidRelationships)) {
      for (const from of rule.from) {
        for (const to of rule.to) {
          expect(isValidRelationship(edgeType as any, from, to)).toBe(true);
        }
      }
    }
  });
});

describe('meetsConfidenceThreshold', () => {
  it('node threshold is 0.7', () => {
    expect(meetsConfidenceThreshold(0.7)).toBe(true);
    expect(meetsConfidenceThreshold(0.69)).toBe(false);
    expect(meetsConfidenceThreshold(1.0)).toBe(true);
    expect(meetsConfidenceThreshold(0.0)).toBe(false);
  });

  it('edge threshold is 0.75', () => {
    expect(meetsConfidenceThreshold(0.75, true)).toBe(true);
    expect(meetsConfidenceThreshold(0.74, true)).toBe(false);
    expect(meetsConfidenceThreshold(1.0, true)).toBe(true);
  });

  it('matches ExtractionConfig values', () => {
    expect(meetsConfidenceThreshold(ExtractionConfig.minConfidence)).toBe(true);
    expect(meetsConfidenceThreshold(ExtractionConfig.minRelationshipConfidence, true)).toBe(true);
  });
});

describe('ExtractionConfig', () => {
  it('has expected defaults', () => {
    expect(ExtractionConfig.minConfidence).toBe(0.7);
    expect(ExtractionConfig.minRelationshipConfidence).toBe(0.75);
    expect(ExtractionConfig.requireExplicit).toBe(true);
    expect(ExtractionConfig.maxEntitiesPerMessage).toBe(5);
    expect(ExtractionConfig.maxRelationshipsPerMessage).toBe(5);
  });
});
