import { describe, it, expect } from 'vitest';
import { entityExtractorService } from '../services/knowledge-graph/entity-extractor.service.js';

describe('entityExtractorService.validateNodes', () => {
  const existingNodes = [
    { name: 'PostgreSQL', type: 'Resource' },
    { name: 'Build API', type: 'Task' },
  ];

  it('accepts valid nodes above confidence threshold', () => {
    const nodes = [
      { name: 'React', type: 'Resource', confidence: 0.9, source: 'We will use React' },
    ];
    const result = entityExtractorService.validateNodes(nodes, existingNodes);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('React');
  });

  it('rejects nodes below confidence threshold (0.7)', () => {
    const nodes = [
      { name: 'Maybe Vue', type: 'Resource', confidence: 0.5, source: 'maybe vue' },
    ];
    const result = entityExtractorService.validateNodes(nodes, existingNodes);
    expect(result).toHaveLength(0);
  });

  it('rejects nodes with invalid type', () => {
    const nodes = [
      { name: 'Something', type: 'InvalidType', confidence: 0.9, source: 'something' },
    ];
    const result = entityExtractorService.validateNodes(nodes, existingNodes);
    expect(result).toHaveLength(0);
  });

  it('rejects duplicate names (case-insensitive)', () => {
    const nodes = [
      { name: 'postgresql', type: 'Resource', confidence: 0.9, source: 'use postgresql' },
    ];
    const result = entityExtractorService.validateNodes(nodes, existingNodes);
    expect(result).toHaveLength(0);
  });

  it('rejects nodes without source quote', () => {
    const nodes = [
      { name: 'Redis', type: 'Resource', confidence: 0.9, source: '' },
      { name: 'Mongo', type: 'Resource', confidence: 0.9, source: '   ' },
    ];
    const result = entityExtractorService.validateNodes(nodes, existingNodes);
    expect(result).toHaveLength(0);
  });

  it('respects maxEntitiesPerMessage limit', () => {
    const nodes = Array.from({ length: 10 }, (_, i) => ({
      name: `Entity${i}`,
      type: 'Resource',
      confidence: 0.9,
      source: `source for entity ${i}`,
    }));
    const result = entityExtractorService.validateNodes(nodes, []);
    expect(result.length).toBeLessThanOrEqual(5); // ExtractionConfig.maxEntitiesPerMessage
  });
});

describe('entityExtractorService.validateEdges', () => {
  const existingNodes = [
    { name: 'Build API', type: 'Task' },
    { name: 'Ship Product', type: 'Goal' },
  ];

  const newNodes = [
    { name: 'Use PostgreSQL', type: 'Task' as const, confidence: 0.9, source: 'src' },
  ];

  it('accepts valid edges', () => {
    const edges = [
      { from: 'Build API', to: 'Ship Product', type: 'ACHIEVES', confidence: 0.85, source: 'building API to ship' },
    ];
    const result = entityExtractorService.validateEdges(edges, newNodes, existingNodes);
    expect(result).toHaveLength(1);
  });

  it('rejects edges below relationship confidence threshold (0.75)', () => {
    const edges = [
      { from: 'Build API', to: 'Ship Product', type: 'ACHIEVES', confidence: 0.7, source: 'src' },
    ];
    const result = entityExtractorService.validateEdges(edges, newNodes, existingNodes);
    expect(result).toHaveLength(0);
  });

  it('rejects edges with invalid type', () => {
    const edges = [
      { from: 'Build API', to: 'Ship Product', type: 'INVALID_TYPE', confidence: 0.9, source: 'src' },
    ];
    const result = entityExtractorService.validateEdges(edges, newNodes, existingNodes);
    expect(result).toHaveLength(0);
  });

  it('rejects edges referencing non-existent nodes', () => {
    const edges = [
      { from: 'NonExistent', to: 'Ship Product', type: 'ACHIEVES', confidence: 0.9, source: 'src' },
    ];
    const result = entityExtractorService.validateEdges(edges, newNodes, existingNodes);
    expect(result).toHaveLength(0);
  });

  it('rejects edges with invalid relationship pattern', () => {
    // ACHIEVES must be Task -> Goal, not Goal -> Task
    const edges = [
      { from: 'Ship Product', to: 'Build API', type: 'ACHIEVES', confidence: 0.9, source: 'src' },
    ];
    const result = entityExtractorService.validateEdges(edges, newNodes, existingNodes);
    expect(result).toHaveLength(0);
  });

  it('rejects edges without source', () => {
    const edges = [
      { from: 'Build API', to: 'Ship Product', type: 'ACHIEVES', confidence: 0.9, source: '' },
    ];
    const result = entityExtractorService.validateEdges(edges, newNodes, existingNodes);
    expect(result).toHaveLength(0);
  });

  it('can reference new nodes by name (case-insensitive)', () => {
    const edges = [
      { from: 'use postgresql', to: 'Ship Product', type: 'ACHIEVES', confidence: 0.85, source: 'using pg to ship' },
    ];
    const result = entityExtractorService.validateEdges(edges, newNodes, existingNodes);
    expect(result).toHaveLength(1);
  });
});

describe('entityExtractorService.shouldUseDomainExtraction', () => {
  it('returns true for long content (>300 words)', () => {
    const longContent = Array(301).fill('word').join(' ');
    expect(entityExtractorService.shouldUseDomainExtraction(longContent)).toBe(true);
  });

  it('returns false for short content', () => {
    expect(entityExtractorService.shouldUseDomainExtraction('I want to build an API')).toBe(false);
  });

  it('returns true for structured content with 3+ markers', () => {
    const structured = `
      Entity: User
      Attributes: name, email
      Process: Registration
      1. User signs up
      2. Email verification
      3. Profile creation
    `;
    expect(entityExtractorService.shouldUseDomainExtraction(structured)).toBe(true);
  });

  it('returns false for content with fewer than 3 markers', () => {
    const minimal = 'I want to build something with React';
    expect(entityExtractorService.shouldUseDomainExtraction(minimal)).toBe(false);
  });
});

describe('entityExtractorService.emptyUnifiedResult', () => {
  it('returns empty arrays for all fields', () => {
    const result = entityExtractorService.emptyUnifiedResult();
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
    expect(result.entityAliases).toEqual([]);
    expect(result.coOccurrences).toEqual([]);
    expect(result.contradictions).toEqual([]);
    expect(result.reasoningLinks).toEqual([]);
  });
});
