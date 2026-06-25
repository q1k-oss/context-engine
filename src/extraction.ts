/**
 * Barrel-free entry for the document-extraction pipeline (ADR-037).
 *
 * q1k-controlplane's Temporal activities import THIS module
 * (`@q1k-oss/context-engine/extraction`) — NOT the main `index.ts` barrel,
 * which re-exports the Express routers + server stack. Everything here is a
 * pure function (Docling subprocess / MINT encode / chunk); no express, no DB,
 * no router imports — so the consuming worker stays dependency-light.
 */
export { doclingClientService } from './services/files/docling-client.service.js';
export { toMintDocument, structureToMint } from './services/files/mint-mapper.js';
export { chunkDocument } from './services/files/chunker.js';
export type { DocumentChunk, ChunkOptions } from './services/files/chunker.js';
export type {
  ExtractedContent,
  DocumentStructure,
  DocumentMetadata,
} from './types/index.js';
