import { describe, it, expect } from 'vitest';
import * as shared from '../index.js';

describe('shared package exports', () => {
  it('exports NodeType constants', () => {
    expect(shared.NodeType).toBeDefined();
    expect(shared.NodeType.Entity).toBe('Entity');
    expect(shared.NodeType.Concept).toBe('Concept');
    expect(shared.NodeType.Decision).toBe('Decision');
  });

  it('exports EdgeType constants', () => {
    expect(shared.EdgeType).toBeDefined();
    expect(shared.EdgeType.RelatesTo).toBe('RELATES_TO');
    expect(shared.EdgeType.Causes).toBe('CAUSES');
  });

  it('exports MessageRole constants', () => {
    expect(shared.MessageRole).toBeDefined();
    expect(shared.MessageRole.User).toBe('user');
    expect(shared.MessageRole.Assistant).toBe('assistant');
    expect(shared.MessageRole.System).toBe('system');
  });

  it('exports SSEEventType constants', () => {
    expect(shared.SSEEventType).toBeDefined();
    expect(shared.SSEEventType.TextDelta).toBe('text_delta');
    expect(shared.SSEEventType.MessageComplete).toBe('message_complete');
    expect(shared.SSEEventType.GraphUpdate).toBe('graph_update');
    expect(shared.SSEEventType.Error).toBe('error');
  });

  it('exports WorkflowNodeTypes', () => {
    expect(shared.WorkflowNodeTypes).toBeDefined();
    expect(shared.WorkflowNodeTypes.GOAL).toBe('Goal');
    expect(shared.WorkflowNodeTypes.TASK).toBe('Task');
    expect(shared.WorkflowNodeTypes.DECISION).toBe('Decision');
  });

  it('exports WorkflowEdgeTypes', () => {
    expect(shared.WorkflowEdgeTypes).toBeDefined();
    expect(shared.WorkflowEdgeTypes.ACHIEVES).toBe('ACHIEVES');
    expect(shared.WorkflowEdgeTypes.REQUIRES).toBe('REQUIRES');
  });

  it('exports validation functions', () => {
    expect(typeof shared.isValidNodeType).toBe('function');
    expect(typeof shared.isValidEdgeType).toBe('function');
    expect(typeof shared.isValidRelationship).toBe('function');
    expect(typeof shared.meetsConfidenceThreshold).toBe('function');
  });

  it('exports ExtractionConfig', () => {
    expect(shared.ExtractionConfig).toBeDefined();
    expect(typeof shared.ExtractionConfig.minConfidence).toBe('number');
  });

  it('exports FileProcessingStatus', () => {
    expect(shared.FileProcessingStatus).toBeDefined();
    expect(shared.FileProcessingStatus.Pending).toBe('pending');
    expect(shared.FileProcessingStatus.Completed).toBe('completed');
  });

  it('exports SupportedMimeTypes', () => {
    expect(shared.SupportedMimeTypes).toBeDefined();
    expect(shared.SupportedMimeTypes.PDF).toBe('application/pdf');
  });
});
