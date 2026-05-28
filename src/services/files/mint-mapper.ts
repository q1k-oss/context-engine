import {
  encodeDocument,
  type MintDocument,
  type MintSection,
} from '@q1k-oss/mint-format';
import type { DocumentStructure, DocumentMetadata } from '../../types/index.js';

/**
 * Map an extracted document (Docling/Gemini `DocumentStructure`) onto a
 * `MintDocument`. `DocumentStructure` keeps sections / tables / lists / figures
 * as parallel arrays, so tables/lists/figures are grouped into trailing
 * sections — enough for token-efficient, lossless prompt injection.
 */
export function toMintDocument(
  structure: DocumentStructure,
  metadata?: DocumentMetadata
): MintDocument {
  const sections: MintSection[] = [];

  for (const s of structure.sections ?? []) {
    sections.push({
      heading: s.heading,
      level: s.level ?? 1,
      blocks: s.content ? [{ type: 'text', text: s.content }] : [],
    });
  }

  if (structure.tables?.length) {
    sections.push({
      heading: 'Tables',
      level: 1,
      blocks: structure.tables.map((t) => ({
        type: 'table' as const,
        table: { caption: t.caption, headers: t.headers, rows: t.rows },
      })),
    });
  }

  if (structure.lists?.length) {
    sections.push({
      heading: 'Lists',
      level: 1,
      blocks: structure.lists.map((l) => ({
        type: 'list' as const,
        list: { ordered: l.type === 'ordered', items: l.items },
      })),
    });
  }

  if (structure.figures?.length) {
    sections.push({
      heading: 'Figures',
      level: 1,
      blocks: structure.figures.map((f) => ({
        type: 'figure' as const,
        figure: { caption: f.caption, page: f.pageRef },
      })),
    });
  }

  const meta: Record<string, string | number> = {};
  if (metadata?.pageCount != null) meta.pages = metadata.pageCount;
  if (metadata?.wordCount != null) meta.words = metadata.wordCount;
  if (metadata?.author) meta.author = metadata.author;
  if (metadata?.language) meta.language = metadata.language;

  return {
    title: structure.title,
    metadata: Object.keys(meta).length ? meta : undefined,
    sections,
  };
}

/** Convenience: structure → MINT string. */
export function structureToMint(
  structure: DocumentStructure,
  metadata?: DocumentMetadata
): string {
  return encodeDocument(toMintDocument(structure, metadata));
}
