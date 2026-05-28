/**
 * Smoke test for the Docling → MINT path.
 *
 * Always runs the deterministic MINT-mapping check (no Docling needed):
 *   npx tsx scripts/smoke-docling.ts
 *
 * Optionally runs the real Docling extractor on a file (requires `uv sync`
 * to have installed Docling + first-run model download):
 *   npx tsx scripts/smoke-docling.ts path/to/sample.pdf
 */
import { decodeDocument } from '@q1k-oss/mint-format';
import { structureToMint } from '../src/services/files/mint-mapper.js';
import { doclingClientService } from '../src/services/files/docling-client.service.js';
import type { DocumentStructure } from '../src/types/index.js';

const sample: DocumentStructure = {
  title: 'Sample SOP',
  sections: [
    { heading: 'Overview', content: 'Covers returns within 30 days.', level: 1, pageRef: 1 },
    { heading: 'Eligibility', content: 'Items must be unused.', level: 2, pageRef: 2 },
  ],
  tables: [{ caption: 'Windows', headers: ['Category', 'Days'], rows: [['Apparel', '30']] }],
  lists: [{ type: 'ordered', items: ['Inspect item', 'Issue refund'] }],
  figures: [{ caption: 'Refund flow', pageRef: 2 }],
};

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`SMOKE FAIL: ${msg}`);
}

async function main(): Promise<void> {
  const mint = structureToMint(sample, { pageCount: 4, author: 'Acme' });
  console.log('--- MINT ---\n' + mint + '\n');

  assert(mint.includes('§1 Overview'), 'heading not rendered');
  assert(mint.includes('| Category | Days |'), 'table not rendered');
  assert(mint.includes('1. Inspect item'), 'ordered list not rendered');
  assert(mint.includes('@fig:'), 'figure not rendered');

  const decoded = decodeDocument(mint);
  assert(decoded.sections.length >= 2, 'sections lost on decode round-trip');
  console.log(`MINT mapping OK — ${decoded.sections.length} sections round-tripped.\n`);

  const file = process.argv[2];
  if (file) {
    console.log(`Running Docling on ${file} ...`);
    const r = await doclingClientService.extractFromFile({ storagePath: file, mimeType: 'application/pdf' });
    if (!r.success) {
      console.log(`Docling failed (expected if not installed): ${r.error}`);
      return;
    }
    const s = r.extractedContent?.structure;
    assert(!!s, 'docling returned no structure');
    console.log('Docling OK. MINT preview:\n' + structureToMint(s!, r.extractedContent?.metadata).slice(0, 500));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
