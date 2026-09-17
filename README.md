<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/logo-dark.svg">
    <img src=".github/logo.svg" alt="context-engine" width="88">
  </picture>
</p>

<h1 align="center">@q1k-oss/context-engine</h1>

<p align="center"><strong>Conversations become a graph</strong></p>

<p align="center">
  Turns conversations and files into a versioned knowledge graph.<br>
  Postgres for storage, with Apache AGE for path queries.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@q1k-oss/context-engine"><img src="https://img.shields.io/npm/v/@q1k-oss/context-engine.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@q1k-oss/context-engine"><img src="https://img.shields.io/npm/dm/@q1k-oss/context-engine.svg" alt="npm downloads"></a>
  <a href="https://github.com/q1k-oss/context-engine/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
</p>

<p align="center">
  <a href="#api-reference"><strong>Docs</strong></a> ·
  <a href="https://www.npmjs.com/package/@q1k-oss/context-engine"><strong>npm</strong></a> ·
  <a href="https://github.com/q1k-oss/context-engine"><strong>GitHub</strong></a> ·
  <a href="https://q1k.ai/oss"><strong>q1k-oss</strong></a>
</p>

---

## Overview

Most agents keep their context in a transcript. That works until the transcript is longer
than the window, and then you are summarising, and the details that mattered are the ones
that get summarised away.

Context Engine keeps the context as a graph instead. As a conversation runs, it extracts
entities, processes and business rules and writes them as nodes and edges. Upload a PDF or
a spreadsheet and the same thing happens to its contents. Every change is versioned, so you
can ask what the model believed at turn nine, and diff it against turn fourteen.

Reading back out, you ask for prioritised context rather than the last _n_ messages — the
part of the graph that matters for the question at hand, serialised compactly with
[`@q1k-oss/mint-format`](https://github.com/q1k-oss/mint). With Apache AGE enabled you can
also run Cypher over it: shortest paths, all paths, neighbours.

It runs either as an embeddable SDK or as a standalone Express server.

## Highlights

- **Versioned knowledge graph** — every mutation is a version, with deltas you can replay.
- **Extraction from conversation and files** — entities, processes and rules, plus PDFs,
  images and documents.
- **Prioritised context retrieval** — fetch the relevant subgraph by priority, not by
  recency.
- **Cypher over Postgres** — optional [Apache AGE](https://age.apache.org/) for path
  finding and neighbour queries.
- **Pre-built LLM tools** — 18 tool definitions with Zod schemas, ready to register with
  any tool-use loop.
- **SDK or server** — import the services directly, or run the Express app with SSE
  streaming.

## Install

```bash
npm install @q1k-oss/context-engine
```

Requires Node.js 18+ and a PostgreSQL database. Apache AGE is optional but enabled by
default.

## Quick start

```ts
import { initContextEngine, createApp } from '@q1k-oss/context-engine';

initContextEngine({
  databaseUrl: process.env.DATABASE_URL!,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  googleAiApiKey: process.env.GOOGLE_AI_API_KEY,
});

const app = createApp({ corsOrigin: 'http://localhost:3000' });
app.listen(3001, () => console.log('Context Engine running on :3001'));
```

Push the schema before the first run:

```bash
npx drizzle-kit push
```

## Usage

### Configuration

`initContextEngine` takes the whole configuration:

| Option | Required | Default | Description |
| --- | --- | --- | --- |
| `databaseUrl` | Yes | — | PostgreSQL connection string |
| `anthropicApiKey` | No | — | Anthropic API key for Claude, the reasoning engine |
| `googleAiApiKey` | No | — | Google AI API key for Gemini, used for file extraction |
| `ageEnabled` | No | `true` | Enable Apache AGE graph extensions for Cypher queries |
| `uploadDir` | No | `'./uploads'` | Directory for file uploads |

Running the built-in standalone server (`node dist/server.js`) reads the same settings from
the environment instead:

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `GOOGLE_AI_API_KEY` | Google AI API key for Gemini |
| `AGE_ENABLED` | Set to `'false'` to disable Apache AGE (default: enabled) |
| `UPLOAD_DIR` | File upload directory (default: `'./uploads'`) |
| `CORS_ORIGIN` | CORS origin (default: `'http://localhost:3000'`) |
| `API_PORT` | Server port (default: `3001`) |

### Using the services directly

You do not need the Express layer. Import the services and drive them yourself:

```ts
import {
  initContextEngine,
  chatOrchestratorService,
  graphBuilderService,
  entityExtractorService,
} from '@q1k-oss/context-engine';

initContextEngine({ databaseUrl: process.env.DATABASE_URL! });

const session = await chatOrchestratorService.createSession('My Agent');

for await (const event of chatOrchestratorService.processMessage(session.id, 'Build me a support agent')) {
  if (event.type === 'text_delta') process.stdout.write(event.data.delta);
}

const graph = await graphBuilderService.getGraph(session.id);
```

### Registering the graph as LLM tools

The package ships tool definitions that plug into any tool-use system — Claude, OpenAI, or
your own loop. Each carries a Zod schema for validation and an `execute` function.

```ts
import { initContextEngine, contextEngineTools } from '@q1k-oss/context-engine';

initContextEngine({ databaseUrl: process.env.DATABASE_URL! });

for (const tool of contextEngineTools) {
  register({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters, // Zod schema
    run: tool.execute,
  });
}
```

Import the groups individually if you want a narrower surface:

```ts
import { nodeTools, edgeTools, graphTools, aliasTools } from '@q1k-oss/context-engine/tools';
```

### Database setup

PostgreSQL is required. Set `DATABASE_URL`, then push the Drizzle schema:

```bash
npx drizzle-kit push
```

`docker-compose.yml` in this repository brings up a plain PostgreSQL 16 for local work.
For Cypher queries you also need the [Apache AGE](https://age.apache.org/) extension on
that instance — either swap the image for `apache/age`, or set `ageEnabled: false` and skip
the Cypher endpoints.

## API reference

### Subpath imports

| Import | Contents |
| --- | --- |
| `@q1k-oss/context-engine` | Services, `initContextEngine`, `contextEngineTools` |
| `@q1k-oss/context-engine/app` | `createApp` — the Express application |
| `@q1k-oss/context-engine/config` | Configuration helpers |
| `@q1k-oss/context-engine/db` | `getDb` and the Drizzle client |
| `@q1k-oss/context-engine/db/schema` | Tables: `sessions`, `knowledgeNodes`, … |
| `@q1k-oss/context-engine/tools` | `nodeTools`, `edgeTools`, `graphTools`, `aliasTools` |
| `@q1k-oss/context-engine/types` | `Session`, `KnowledgeNode` and friends |

### LLM tools

| Group | Tools |
| --- | --- |
| **Node** | `create_node`, `get_node`, `update_node`, `delete_node`, `list_nodes`, `search_nodes` |
| **Edge** | `create_edge`, `get_edge`, `delete_edge`, `list_edges` |
| **Graph** | `get_graph`, `get_prioritized_context`, `get_graph_version`, `list_graph_versions`, `get_context_deltas`, `repair_orphans` |
| **Alias** | `add_alias`, `list_aliases` |

### HTTP endpoints

Available once you mount `createApp()`.

**Chat**

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/chat/sessions` | Create a session |
| `GET` | `/api/chat/sessions` | List sessions |
| `GET` | `/api/chat/sessions/:id` | Get session with messages |
| `DELETE` | `/api/chat/sessions/:id` | Delete session |
| `POST` | `/api/chat/sessions/:id/messages` | Send message (SSE stream) |

**Files**

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/files/upload` | Upload a file (PDF, images, text, docx; 50 MB limit) |
| `GET` | `/api/files/:id` | Get file metadata |
| `GET` | `/api/files/:id/content` | Get extracted content |
| `DELETE` | `/api/files/:id` | Delete file |

**Knowledge graph**

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/graph/:sessionId` | Get full knowledge graph |
| `GET` | `/api/graph/:sessionId/versions` | List graph versions |
| `GET` | `/api/graph/:sessionId/versions/:version` | Get a specific graph version |
| `GET` | `/api/graph/:sessionId/deltas` | Get the context evolution timeline |
| `GET` | `/api/graph/:sessionId/deltas/:deltaId` | Get a specific delta |
| `GET` | `/api/graph/:sessionId/context` | Get prioritised context (`?minPriority=0.3`) |
| `POST` | `/api/graph/:sessionId/repair-orphans` | Repair orphan nodes via LLM semantic matching |

**Apache AGE / Cypher** — requires `ageEnabled: true` (the default).

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/graph/:sessionId/age` | Get the graph from Apache AGE |
| `GET` | `/api/graph/:sessionId/path` | Find the shortest path (`?from=&to=`) |
| `GET` | `/api/graph/:sessionId/paths` | Find all paths (`?from=&to=&maxHops=5`) |
| `GET` | `/api/graph/:sessionId/neighbors/:nodeId` | Get node neighbours (`?direction=both`) |
| `POST` | `/api/graph/:sessionId/cypher` | Execute a read-only Cypher query |

**Domain extraction**

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/graph/domain/extract` | Extract a complete domain graph from documentation |
| `POST` | `/api/graph/domain/entities` | Extract entities from documentation |
| `POST` | `/api/graph/domain/processes` | Extract processes and workflows |
| `POST` | `/api/graph/domain/rules` | Extract business rules |

## Development

Architecture in one table:

| Piece | Role |
| --- | --- |
| **Claude** | Primary reasoning engine; receives conversation history plus graph context |
| **Gemini** | File extraction only — PDFs, images, documents |
| **mint-format** | Token-efficient serialisation of graph context into prompts |
| **Drizzle ORM** | PostgreSQL schema and queries |
| **Apache AGE** | Optional Cypher graph queries |
| **Express** | HTTP API with SSE streaming |
| **Zod** | Request validation and tool parameter schemas |

```bash
npm install

npm run dev          # tsx watch src/server.ts
npm run build        # tsc into dist/
npm run start        # node dist/server.js

npm run db:generate  # generate a migration from the schema
npm run db:migrate   # apply migrations
npm run db:push      # push the schema straight to the database
npm run db:studio    # open Drizzle Studio
```

`docker-compose.yml` brings up PostgreSQL with Apache AGE for local work. Python helpers
used by the file-extraction path live in `python/`, configured through `pyproject.toml`.

## Contributing

Contributions are welcome.

1. Fork the repository and clone your fork.
2. Create a branch: `git checkout -b feat/my-change`.
3. `npm install`, then `npm run build` to confirm the project still compiles.
4. Update this README for anything that changes the public surface.
5. Commit using [Conventional Commits](https://www.conventionalcommits.org/) and open a
   pull request.

## Related projects

Context Engine is part of the q1k-oss family — see
[q1k.ai/oss](https://q1k.ai/oss).

| Package | What it does |
| --- | --- |
| [`@q1k-oss/mint-format`](https://github.com/q1k-oss/mint) | Token-efficient data format for LLM prompts |
| [`@q1k-oss/context-engine`](https://github.com/q1k-oss/context-engine) | Turns conversations and files into a versioned knowledge graph |
| [`@q1k-oss/behaviour-tree-workflows`](https://github.com/q1k-oss/behaviour-tree-workflows) | Declarative behaviour trees in YAML, durable via Temporal |
| [`@q1k-oss/kiban`](https://github.com/q1k-oss/kiban) | React components on Radix primitives and Tailwind |

## License

[MIT](LICENSE)
