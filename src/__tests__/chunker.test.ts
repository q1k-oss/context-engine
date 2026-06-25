import { describe, it, expect } from 'vitest';
import { chunkDocument } from '../services/files/chunker.js';
import type { DocumentStructure } from '../types/index.js';

const sample: DocumentStructure = {
  title: 'SOP',
  sections: [
    { heading: 'Overview', content: 'Covers returns within 30 days.', level: 1, pageRef: 1 },
    { heading: 'Eligibility', content: 'Items must be unused.', level: 2, pageRef: 2 },
  ],
  tables: [{ caption: 'Windows', headers: ['Channel', 'Days'], rows: [['D2C', '30'], ['WFM', '14']] }],
  lists: [{ type: 'ordered', items: ['Inspect', 'Refund'] }],
  figures: [{ caption: 'flow', pageRef: 2 }],
};

describe('chunkDocument', () => {
  it('emits one chunk per section + table + list (figures skipped)', () => {
    const chunks = chunkDocument(sample);
    // 2 sections + 1 table + 1 list = 4
    expect(chunks).toHaveLength(4);
  });

  it('assigns stable 0..n chunkIndex (idempotency key)', () => {
    const chunks = chunkDocument(sample);
    expect(chunks.map((c) => c.chunkIndex)).toEqual([0, 1, 2, 3]);
    // deterministic across runs
    expect(chunkDocument(sample).map((c) => c.text)).toEqual(chunks.map((c) => c.text));
  });

  it('preserves provenance (sectionRef + pageRef)', () => {
    const chunks = chunkDocument(sample);
    const overview = chunks.find((c) => c.sectionRef === 'Overview');
    expect(overview?.pageRef).toBe(1);
    expect(overview?.text).toContain('Overview');
    expect(overview?.text).toContain('30 days');
  });

  it('renders table rows into a single coherent chunk', () => {
    const chunks = chunkDocument(sample);
    const table = chunks.find((c) => c.sectionRef === 'Windows');
    expect(table?.text).toContain('Channel | Days');
    expect(table?.text).toContain('D2C | 30');
    expect(table?.text).toContain('WFM | 14');
  });

  it('splits an oversized section with overlap', () => {
    const para = 'Sentence number ' + 'x'.repeat(40) + '. ';
    const big: DocumentStructure = {
      sections: [{ heading: 'Big', content: para.repeat(60), level: 1, pageRef: 3 }],
    };
    const chunks = chunkDocument(big, { maxChars: 300, overlapChars: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.text.length <= 300 + 60)).toBe(true); // ~maxChars + heading slack
    expect(chunks.every((c) => c.sectionRef === 'Big' && c.pageRef === 3)).toBe(true);
  });

  it('returns [] for empty structure', () => {
    expect(chunkDocument({})).toEqual([]);
    expect(chunkDocument({ sections: [{ heading: '', content: '', level: 1 }] })).toEqual([]);
  });
});
