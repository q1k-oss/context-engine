import { describe, it, expect } from 'vitest';

// The levenshteinDistance function is not exported, so we reimplement it here
// to test the algorithm that graph-builder uses internally.
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

// Fuzzy match logic used in graph-builder's findSimilarNode
function findSimilarNode(
  name: string,
  existingNodes: Array<{ name: string }>
): { name: string } | undefined {
  const lowerName = name.toLowerCase();
  return existingNodes.find((n) => {
    const existingLower = n.name.toLowerCase();
    return (
      existingLower === lowerName ||
      existingLower.includes(lowerName) ||
      lowerName.includes(existingLower)
    );
  });
}

describe('levenshteinDistance', () => {
  it('identical strings = 0', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0);
  });

  it('empty strings = 0', () => {
    expect(levenshteinDistance('', '')).toBe(0);
  });

  it('one empty string = length of other', () => {
    expect(levenshteinDistance('abc', '')).toBe(3);
    expect(levenshteinDistance('', 'xyz')).toBe(3);
  });

  it('single character difference', () => {
    expect(levenshteinDistance('cat', 'bat')).toBe(1);
    expect(levenshteinDistance('cat', 'car')).toBe(1);
  });

  it('insertion', () => {
    expect(levenshteinDistance('cat', 'cats')).toBe(1);
  });

  it('deletion', () => {
    expect(levenshteinDistance('cats', 'cat')).toBe(1);
  });

  it('completely different strings', () => {
    expect(levenshteinDistance('abc', 'xyz')).toBe(3);
  });

  it('PostgreSQL vs Postgres', () => {
    const dist = levenshteinDistance('postgresql', 'postgres');
    expect(dist).toBe(2); // remove 'q' and 'l'
  });

  it('is symmetric', () => {
    expect(levenshteinDistance('abc', 'def')).toBe(levenshteinDistance('def', 'abc'));
    expect(levenshteinDistance('react', 'reactive')).toBe(levenshteinDistance('reactive', 'react'));
  });
});

describe('findSimilarNode (fuzzy matching)', () => {
  const nodes = [
    { name: 'PostgreSQL' },
    { name: 'Build REST API' },
    { name: 'React' },
  ];

  it('exact match (case-insensitive)', () => {
    expect(findSimilarNode('postgresql', nodes)?.name).toBe('PostgreSQL');
    expect(findSimilarNode('REACT', nodes)?.name).toBe('React');
  });

  it('substring match: query contained in existing', () => {
    expect(findSimilarNode('REST API', nodes)?.name).toBe('Build REST API');
  });

  it('substring match: existing contained in query', () => {
    expect(findSimilarNode('React Native', nodes)?.name).toBe('React');
  });

  it('no match returns undefined', () => {
    expect(findSimilarNode('Vue.js', nodes)).toBeUndefined();
    expect(findSimilarNode('MongoDB', nodes)).toBeUndefined();
  });
});
