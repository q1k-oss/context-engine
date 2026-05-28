# CLAUDE.md

Guidance for Claude Code when working in the **context-engine** repo.

## What this is

`@q1k-oss/context-engine` — a TypeScript SDK + HTTP service for the customer-knowledge layer: file ingestion, knowledge-graph extraction, and prioritized-context retrieval for LLM prompts. It is consumed by `q1k-controlplane` as a vendored npm dependency (with a patch). Initialize with `initContextEngine({ databaseUrl, ... })` before using any service.

## Commands

```bash
npm run dev          # tsx watch src/server.ts
npm run build        # tsc -> dist/
npm run start        # node dist/server.js
npm run db:push      # apply schema to the DB (this repo uses push, not migrations)
npm run db:studio
```

## File extraction (upload → knowledge graph)

`POST /api/files/upload` → `fileProcessorService.saveFile` (writes to `uploadDir`, default `./uploads`) → async `processFile`:

1. **Extract** via the configured extractor:
   - `extractor: 'docling'` (default) — `doclingClientService` spawns `python/docling_extract.py` (Docling). On any failure it **falls back to Gemini**, so a missing Python/Docling runtime degrades gracefully.
   - `extractor: 'gemini'` — `geminiClientService` (extraction only, never reasoning).
   Both return the same `ExtractedContent` shape (`src/types/file.types.ts`).
2. **Serialize to MINT** — `structureToMint` (`src/services/files/mint-mapper.ts`) encodes the document `structure` via `@q1k-oss/mint-format`'s `encodeDocument` and stores it in `files.mint_content` for token-efficient prompt injection.
3. **Integrate into the graph** — `integrateIntoGraph` creates `Artifact` + `Entity` nodes/edges.

### Docling (Python) setup

Docling is a Python dependency (`pyproject.toml`), not bundled with the JS package. To run the default extractor locally:

```bash
uv sync                                   # installs Docling (first run pulls ML models, ~hundreds of MB)
npx tsx scripts/smoke-docling.ts          # MINT-mapping smoke (no Docling needed)
npx tsx scripts/smoke-docling.ts file.pdf # real Docling extraction on a file
```

Override the Python command with `DOCLING_CMD` (default `uv run python`). The script must emit valid JSON to stdout or exit non-zero (the TS caller falls back to Gemini on failure).

## MINT usage

MINT (`@q1k-oss/mint-format`) is used to pack data into LLM prompts token-efficiently: graph nodes/edges (`claude-client.service.ts`, `encode`) and now parsed documents (`encodeDocument`, see the mapper above). Requires `@q1k-oss/mint-format` ≥ 1.1.0 (adds `encodeDocument`/`decodeDocument`).

## Conventions

- ESM, NodeNext module resolution — **import with `.js` extensions** even from `.ts`.
- Schema in `src/db/schema/*.ts`; apply with `db:push`.
- HTTP routes currently use a trusted-caller pattern (no JWT yet) — q1k-auth middleware is a planned hardening item.
