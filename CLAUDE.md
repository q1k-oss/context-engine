# CLAUDE.md

Guidance for Claude Code when working in the **context-engine** repo.

## What this is

`@q1k-oss/context-engine` — a TypeScript **library** (plus an optional standalone HTTP server) for the customer-knowledge layer: document extraction, knowledge-graph building, and prioritized-context retrieval.

**Primary consumption (ADR-037): as a library.** `q1k-controlplane`'s Temporal worker imports this package and calls its pure functions **in-process** inside activities — there is no deployed context-engine HTTP service in the document-ingestion path. context-engine owns the *domain logic* (Docling/Gemini extraction, entity extraction, MINT mapping, chunking); durability/retry/concurrency/persistence live in controlplane's Temporal workflow + tenant Postgres. This mirrors the btree (logic) + Temporal (durability) split.

The Express server (`src/server.ts`, `createApp`) still exists for standalone chat/graph use, but the **file-upload route and async `processFile` orchestration were removed** (ADR-037) — ingestion is controlplane's job now.

## The library surface (what controlplane imports)

Pure, side-effect-free functions exported from `src/index.ts`:

- `doclingClientService.extractFromFile({ storagePath, mimeType })` → `ExtractedContent` (spawns the Python Docling adapter; falls back to Gemini on failure).
- `structureToMint(structure, metadata)` / `toMintDocument(...)` → token-efficient MINT encoding (`@q1k-oss/mint-format` ≥ 1.1.0).
- `chunkDocument(structure, opts)` → `DocumentChunk[]` — §-boundary chunks with overlap + `{ text, sectionRef, pageRef, chunkIndex }`. Deterministic (stable `chunkIndex` = idempotency key for the persist activity).
- `claudeClientService` / `geminiClientService` — LLM clients (extraction only).
- Types from `src/types/` (`ExtractedContent`, `DocumentStructure`, `DocumentChunk`).

None of these touch the DB or filesystem (beyond Docling reading the file path it's handed). Persistence (`knowledge_chunks`, the `kg_*` tables) is controlplane's.

## Commands

```bash
npm run build        # tsc -> dist/
npm test             # vitest run
npm run dev          # tsx watch src/server.ts (standalone server)
npm run db:push      # apply schema (standalone server only; controlplane owns its own tenant schemas)
```

## Document extraction (Docling)

`doclingClientService.extractFromFile()` spawns `python/docling_extract.py` (Docling). On any failure it falls back to Gemini, so a missing Python/Docling runtime degrades gracefully.

- **Device:** the layout model (RT-DETR-v2) requests float64, unsupported on Apple-Silicon MPS. The script pins the accelerator via **`DOCLING_DEVICE`** (default `cpu`, verified stable on macOS). Set `DOCLING_DEVICE=cuda`/`mps`/`auto` on a capable host.
- **Python command:** override `uv run python` via **`DOCLING_CMD`** (e.g. `python3`, or `uv run --project <ce-repo> python` when consuming this package from another repo whose cwd lacks the Docling env).
- **Packaging:** `python/` + `pyproject.toml` ship in the npm package (`files` field) so the script travels with the library. The consuming worker still needs a Python+Docling runtime reachable via `DOCLING_CMD`.

Local Docling setup:
```bash
uv sync                                              # installs Docling (first run pulls ML models, ~hundreds of MB)
npx tsx scripts/smoke-docling.ts                     # MINT + chunk smoke (no Docling needed)
DOCLING_CMD="uv run python" npx tsx scripts/smoke-docling.ts file.pdf   # real Docling extraction + chunking
```

## MINT usage

MINT (`@q1k-oss/mint-format`) packs data into LLM prompts token-efficiently: graph nodes/edges (`claude-client.service.ts`) and parsed documents (`structureToMint`/`encodeDocument`). Requires `@q1k-oss/mint-format` ≥ 1.1.0.

## Conventions

- ESM, NodeNext — **import with `.js` extensions** even from `.ts`.
- Subpath imports break `require()` of `package.json` — use the declared `exports`.
- Schema in `src/db/schema/*.ts`. The `files` table is now **dead** (orchestration removed); left in place rather than surgically dropped.
- Standalone server routes use a trusted-caller pattern; for the library path, auth/tenant-isolation are the consuming worker's concern.
