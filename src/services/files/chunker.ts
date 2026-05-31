import type { DocumentStructure } from '../../types/index.js';

/**
 * A retrievable chunk of a parsed document — the unit a RAG vector store
 * embeds and returns. Pure data; no DB/IO. The caller (a controlplane Temporal
 * activity) embeds `text` and persists with `chunkIndex` as the idempotency key.
 */
export interface DocumentChunk {
  /** 0-based position in the document; stable across re-runs (idempotency key with fileId). */
  chunkIndex: number;
  /** The chunk text fed to the embedder. */
  text: string;
  /** Section heading this chunk came from (provenance). */
  sectionRef?: string;
  /** 1-based source page, when the extractor provided it (provenance). */
  pageRef?: number;
}

export interface ChunkOptions {
  /** Soft cap on characters per chunk before a section is split. Default 1200 (~300 tokens). */
  maxChars?: number;
  /** Characters of trailing overlap prepended to the next sub-chunk. Default 150. */
  overlapChars?: number;
}

const DEFAULT_MAX_CHARS = 1200;
const DEFAULT_OVERLAP_CHARS = 150;

/**
 * Chunk a parsed `DocumentStructure` into retrievable, embeddable units.
 *
 * Strategy: §-boundary first — each section's `heading + content` is one chunk.
 * Sections longer than `maxChars` are split on paragraph/sentence boundaries with
 * a small character overlap so context isn't severed mid-thought. Tables and lists
 * are emitted as their own chunks (a table row-set is a coherent retrieval unit).
 * Figures are skipped (captions only, low retrieval value).
 *
 * Pure function — deterministic given the same structure + options, so a Temporal
 * activity can re-run it safely (chunkIndex is stable).
 */
export function chunkDocument(
  structure: DocumentStructure,
  opts: ChunkOptions = {},
): DocumentChunk[] {
  const maxChars = opts.maxChars ?? DEFAULT_MAX_CHARS;
  const overlapChars = opts.overlapChars ?? DEFAULT_OVERLAP_CHARS;
  const chunks: DocumentChunk[] = [];

  const push = (text: string, sectionRef?: string, pageRef?: number): void => {
    const trimmed = text.trim();
    if (!trimmed) return;
    chunks.push({ chunkIndex: chunks.length, text: trimmed, sectionRef, pageRef });
  };

  for (const section of structure.sections ?? []) {
    const heading = (section.heading ?? '').trim();
    const content = (section.content ?? '').trim();
    const body = heading ? (content ? `${heading}\n${content}` : heading) : content;
    if (!body) continue;

    if (body.length <= maxChars) {
      push(body, heading || undefined, section.pageRef);
      continue;
    }

    // Section too long → split on paragraph/sentence boundaries with overlap.
    for (const piece of splitWithOverlap(body, maxChars, overlapChars)) {
      push(piece, heading || undefined, section.pageRef);
    }
  }

  for (const table of structure.tables ?? []) {
    const caption = table.caption ? `${table.caption}\n` : '';
    const header = (table.headers ?? []).join(' | ');
    const rows = (table.rows ?? []).map((r) => r.join(' | ')).join('\n');
    const text = `${caption}${header ? header + '\n' : ''}${rows}`;
    push(text, table.caption ?? 'Table');
  }

  for (const list of structure.lists ?? []) {
    const marker = list.type === 'ordered' ? (i: number) => `${i + 1}.` : () => '-';
    const text = (list.items ?? []).map((it, i) => `${marker(i)} ${it}`).join('\n');
    push(text, list.type === 'ordered' ? 'Ordered list' : 'List');
  }

  return chunks;
}

/**
 * Split text into <=maxChars pieces, preferring paragraph then sentence
 * boundaries, with `overlapChars` of the prior piece's tail prepended to each
 * subsequent piece for context continuity.
 */
function splitWithOverlap(text: string, maxChars: number, overlapChars: number): string[] {
  // Prefer paragraph boundaries; fall back to sentence, then hard slice.
  const units = text.split(/\n{2,}/).flatMap((para) =>
    para.length <= maxChars ? [para] : para.split(/(?<=[.!?])\s+/),
  );

  const pieces: string[] = [];
  let current = '';
  for (const unit of units) {
    const candidate = current ? `${current}\n\n${unit}` : unit;
    if (candidate.length > maxChars && current) {
      pieces.push(current);
      const tail = overlapChars > 0 ? current.slice(-overlapChars) : '';
      current = tail ? `${tail}\n\n${unit}` : unit;
    } else if (candidate.length > maxChars) {
      // single unit longer than maxChars → hard-slice it
      for (let i = 0; i < unit.length; i += maxChars) {
        pieces.push(unit.slice(i, i + maxChars));
      }
      current = '';
    } else {
      current = candidate;
    }
  }
  if (current.trim()) pieces.push(current);
  return pieces;
}
