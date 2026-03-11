import { describe, it, expect } from 'vitest';
import { encode, decode } from '@q1k-oss/mint-format';

describe('MINT format integration', () => {
  describe('knowledge graph node encoding', () => {
    it('encodes nodes array as MINT table', () => {
      const nodes = [
        { name: 'PostgreSQL', type: 'Resource' },
        { name: 'Build API', type: 'Task' },
        { name: 'Auth Module', type: 'Goal' },
      ];

      const mint = encode({ nodes });
      expect(mint).toContain('nodes:');
      expect(mint).toContain('PostgreSQL');
      expect(mint).toContain('Resource');
      expect(mint).toContain('Build API');
      expect(mint).toContain('Task');
    });

    it('round-trips nodes through encode/decode', () => {
      const data = {
        nodes: [
          { name: 'React', type: 'Resource' },
          { name: 'Deploy', type: 'Task' },
        ],
      };

      const mint = encode(data);
      const decoded = decode(mint) as typeof data;

      expect(decoded.nodes).toHaveLength(2);
      expect(decoded.nodes[0]).toEqual({ name: 'React', type: 'Resource' });
      expect(decoded.nodes[1]).toEqual({ name: 'Deploy', type: 'Task' });
    });
  });

  describe('knowledge graph edge encoding', () => {
    it('encodes relationships as MINT table', () => {
      const relationships = [
        { source: 'Auth Module', relationship: 'requires', target: 'PostgreSQL' },
        { source: 'Deploy', relationship: 'depends on', target: 'Build API' },
      ];

      const mint = encode({ relationships });
      expect(mint).toContain('relationships:');
      expect(mint).toContain('Auth Module');
      expect(mint).toContain('requires');
      expect(mint).toContain('PostgreSQL');
    });

    it('round-trips edges through encode/decode', () => {
      const data = {
        relationships: [
          { source: 'A', relationship: 'causes', target: 'B' },
        ],
      };

      const mint = encode(data);
      const decoded = decode(mint) as typeof data;

      expect(decoded.relationships).toHaveLength(1);
      expect(decoded.relationships[0]).toEqual({ source: 'A', relationship: 'causes', target: 'B' });
    });
  });

  describe('token efficiency', () => {
    it('MINT is smaller than JSON for node arrays', () => {
      const nodes = Array.from({ length: 20 }, (_, i) => ({
        name: `Entity_${i}`,
        type: i % 2 === 0 ? 'Resource' : 'Task',
        description: `Description for entity ${i}`,
      }));

      const jsonStr = JSON.stringify({ nodes });
      const mintStr = encode({ nodes });

      // MINT should be meaningfully smaller
      expect(mintStr.length).toBeLessThan(jsonStr.length);
    });

    it('MINT is smaller than JSON for edge arrays', () => {
      const edges = Array.from({ length: 15 }, (_, i) => ({
        source: `Entity_${i}`,
        relationship: 'depends_on',
        target: `Entity_${i + 1}`,
      }));

      const jsonStr = JSON.stringify({ edges });
      const mintStr = encode({ edges });

      expect(mintStr.length).toBeLessThan(jsonStr.length);
    });
  });

  describe('handles edge cases', () => {
    it('encodes empty arrays', () => {
      const mint = encode({ nodes: [] });
      expect(mint).toBeDefined();
    });

    it('encodes nodes with optional description field', () => {
      const data = {
        nodes: [
          { name: 'A', type: 'Task' },
          { name: 'B', type: 'Goal', description: 'Some goal' },
        ],
      };

      const mint = encode(data);
      expect(mint).toContain('A');
      expect(mint).toContain('B');
      expect(mint).toContain('Some goal');
    });

    it('encodes special characters in node names', () => {
      const data = {
        nodes: [
          { name: 'User & Admin', type: 'Entity' },
          { name: 'Node.js Runtime', type: 'Resource' },
        ],
      };

      const mint = encode(data);
      const decoded = decode(mint) as typeof data;

      expect(decoded.nodes[0]!.name).toBe('User & Admin');
      expect(decoded.nodes[1]!.name).toBe('Node.js Runtime');
    });
  });
});
