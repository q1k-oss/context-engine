import { describe, it, expect } from 'vitest';
import { priorityCalculatorService } from '../services/knowledge-graph/priority-calculator.service.js';
import type { KnowledgeNode, Message } from '@context-engine/shared';

function makeNode(overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id: 'node-1',
    sessionId: 'session-1',
    nodeType: 'Resource',
    name: 'PostgreSQL',
    graphData: {},
    confidenceScore: '0.90',
    priorityScore: '0.50',
    sourceMessageId: null,
    version: 1,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as KnowledgeNode;
}

function makeMessage(content: string, overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    sessionId: 'session-1',
    role: 'user',
    content,
    sequenceNumber: 1,
    tokenCount: null,
    createdAt: new Date(),
    ...overrides,
  } as Message;
}

describe('priorityCalculatorService', () => {
  describe('getMinPriorityThreshold', () => {
    it('returns 0.3', () => {
      expect(priorityCalculatorService.getMinPriorityThreshold()).toBe(0.3);
    });
  });

  describe('boost', () => {
    it('boosts priority by given amount', () => {
      const node = makeNode({ priorityScore: '0.50' });
      const result = priorityCalculatorService.boost(node, 0.2, 'test boost');
      expect(result.previousPriority).toBe(0.5);
      expect(result.newPriority).toBe(0.7);
      expect(result.reason).toBe('test boost');
    });

    it('caps at 1.0', () => {
      const node = makeNode({ priorityScore: '0.90' });
      const result = priorityCalculatorService.boost(node, 0.5, 'big boost');
      expect(result.newPriority).toBe(1.0);
    });
  });

  describe('decay', () => {
    it('decays priority by given amount', () => {
      const node = makeNode({ priorityScore: '0.60' });
      const result = priorityCalculatorService.decay(node, 0.2, 'test decay');
      expect(result.previousPriority).toBe(0.6);
      expect(result.newPriority).toBe(0.4);
      expect(result.reason).toBe('test decay');
    });

    it('floors at 0.0', () => {
      const node = makeNode({ priorityScore: '0.10' });
      const result = priorityCalculatorService.decay(node, 0.5, 'big decay');
      expect(result.newPriority).toBe(0.0);
    });
  });

  describe('recalculate', () => {
    it('returns empty array for empty nodes', () => {
      const result = priorityCalculatorService.recalculate([], [], 'test');
      expect(result).toEqual([]);
    });

    it('boosts nodes mentioned in current message', () => {
      const node = makeNode({
        id: 'n1',
        name: 'PostgreSQL',
        confidenceScore: '0.80',
        priorityScore: '0.10',
        updatedAt: new Date(),
      });

      const result = priorityCalculatorService.recalculate(
        [node],
        [],
        'We should use PostgreSQL for the database'
      );

      // Should get a boost because "PostgreSQL" is in the current message
      expect(result.length).toBe(1);
      expect(result[0]!.newPriority).toBeGreaterThan(0.1);
    });

    it('boosts nodes mentioned frequently in recent messages', () => {
      const node = makeNode({
        id: 'n1',
        name: 'React',
        confidenceScore: '0.80',
        priorityScore: '0.10',
        updatedAt: new Date(),
      });

      const messages = [
        makeMessage('We should use React for the frontend'),
        makeMessage('React has great component model'),
        makeMessage('React hooks are useful'),
      ];

      const result = priorityCalculatorService.recalculate([node], messages);
      expect(result.length).toBe(1);
      expect(result[0]!.newPriority).toBeGreaterThan(0.1);
      expect(result[0]!.reason).toContain('Mentioned');
    });

    it('applies priority floor for Decision nodes', () => {
      const decisionNode = makeNode({
        id: 'n1',
        nodeType: 'Decision',
        name: 'obscure-decision-xyz',
        confidenceScore: '0.10',
        priorityScore: '0.50',
        updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days old
      });

      const result = priorityCalculatorService.recalculate([decisionNode], []);
      if (result.length > 0) {
        expect(result[0]!.newPriority).toBeGreaterThanOrEqual(0.2);
      }
    });

    it('applies priority floor for Intent nodes', () => {
      const intentNode = makeNode({
        id: 'n1',
        nodeType: 'Intent',
        name: 'obscure-intent-xyz',
        confidenceScore: '0.10',
        priorityScore: '0.50',
        updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      });

      const result = priorityCalculatorService.recalculate([intentNode], []);
      if (result.length > 0) {
        expect(result[0]!.newPriority).toBeGreaterThanOrEqual(0.2);
      }
    });

    it('skips updates with small priority change (<0.05)', () => {
      const node = makeNode({
        id: 'n1',
        name: 'some-node',
        confidenceScore: '0.90',
        // Set priority close to what recalculation would produce
        priorityScore: '0.57',
        updatedAt: new Date(),
      });

      const result = priorityCalculatorService.recalculate([node], []);
      // If the calculated priority is within 0.05 of 0.57, no update
      for (const update of result) {
        expect(Math.abs(update.newPriority - 0.57)).toBeGreaterThan(0.05);
      }
    });

    it('recency factor decays over time', () => {
      const recentNode = makeNode({
        id: 'n1',
        name: 'recent-xyz',
        confidenceScore: '0.80',
        priorityScore: '0.10',
        updatedAt: new Date(),
      });

      const oldNode = makeNode({
        id: 'n2',
        name: 'old-xyz',
        confidenceScore: '0.80',
        priorityScore: '0.10',
        updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days old
      });

      const recentResult = priorityCalculatorService.recalculate([recentNode], []);
      const oldResult = priorityCalculatorService.recalculate([oldNode], []);

      // Recent node should get higher priority than old node
      const recentPriority = recentResult.length > 0 ? recentResult[0]!.newPriority : 0.1;
      const oldPriority = oldResult.length > 0 ? oldResult[0]!.newPriority : 0.1;
      expect(recentPriority).toBeGreaterThan(oldPriority);
    });
  });
});
