# @q1k-oss/context-engine

AI-powered knowledge graph engine that extracts and structures domain knowledge from conversations. Uses Claude as the primary reasoning engine and Gemini for file extraction.

## Install

```bash
npm install @q1k-oss/context-engine
```

## Quick Start

```ts
import { initContextEngine, createApp } from '@q1k-oss/context-engine';

// Initialize with your config
initContextEngine({
  databaseUrl: process.env.DATABASE_URL!,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  googleAiApiKey: process.env.GOOGLE_AI_API_KEY,
});

// Create and start the Express server
const app = createApp({ corsOrigin: 'http://localhost:3000' });
app.listen(3001, () => console.log('Context Engine running on :3001'));
```

## Configuration

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `databaseUrl` | Yes | — | PostgreSQL connection string |
| `anthropicApiKey` | No | — | Anthropic API key for Claude (primary reasoning engine) |
| `googleAiApiKey` | No | — | Google AI API key for Gemini (file extraction only) |
| `ageEnabled` | No | `true` | Enable Apache AGE graph extensions for Cypher queries |
| `uploadDir` | No | `'./uploads'` | Directory for file uploads |

### Environment Variables (Standalone Server)

When running the built-in standalone server (`node dist/server.js`), configuration is read from environment variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `GOOGLE_AI_API_KEY` | Google AI API key for Gemini |
| `AGE_ENABLED` | Set to `'false'` to disable Apache AGE (default: enabled) |
| `UPLOAD_DIR` | File upload directory (default: `'./uploads'`) |
| `CORS_ORIGIN` | CORS origin (default: `'http://localhost:3000'`) |
| `API_PORT` | Server port (default: `3001`) |

## Using Individual Services

You can use services directly without spinning up the full Express server:

```ts
import {
  initContextEngine,
  chatOrchestratorService,
  graphBuilderService,
  entityExtractorService,
} from '@q1k-oss/context-engine';

initContextEngine({ databaseUrl: '...' });

// Create a chat session
const session = await chatOrchestratorService.createSession('My Agent');

// Stream a message
for await (const event of chatOrchestratorService.processMessage(session.id, 'Build me a support agent')) {
  if (event.type === 'text_delta') process.stdout.write(event.data.delta);
}

// Get the knowledge graph
const graph = await graphBuilderService.getGraph(session.id);
```

## LLM Tool Definitions

The SDK exports pre-built tool definitions that can be registered directly with any LLM tool-use system (Claude, OpenAI, etc.):

```ts
import { initContextEngine, contextEngineTools } from '@q1k-oss/context-engine';
import type { ToolDefinition } from '@q1k-oss/context-engine';

initContextEngine({ databaseUrl: '...' });

// Register all tools at once
for (const tool of contextEngineTools) {
  console.log(tool.name, tool.description);
  // tool.parameters — Zod schema for input validation
  // tool.execute(input) — Run the tool with validated input
}
```

You can also import tool groups individually:

```ts
import { nodeTools, edgeTools, graphTools, aliasTools } from '@q1k-oss/context-engine/tools';
```

### Available Tools

**Node Tools** — `create_node`, `get_node`, `update_node`, `delete_node`, `list_nodes`, `search_nodes`

**Edge Tools** — `create_edge`, `get_edge`, `delete_edge`, `list_edges`

**Graph Tools** — `get_graph`, `get_prioritized_context`, `get_graph_version`, `list_graph_versions`, `get_context_deltas`, `repair_orphans`

**Alias Tools** — `add_alias`, `list_aliases`

## Subpath Imports

Import only what you need:

```ts
import { createApp } from '@q1k-oss/context-engine/app';
import { getDb } from '@q1k-oss/context-engine/db';
import { sessions, knowledgeNodes } from '@q1k-oss/context-engine/db/schema';
import { contextEngineTools } from '@q1k-oss/context-engine/tools';
import type { Session, KnowledgeNode } from '@q1k-oss/context-engine/types';
```

## API Endpoints

When using `createApp()`, these routes are available:

### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat/sessions` | Create a session |
| `GET` | `/api/chat/sessions` | List sessions |
| `GET` | `/api/chat/sessions/:id` | Get session with messages |
| `DELETE` | `/api/chat/sessions/:id` | Delete session |
| `POST` | `/api/chat/sessions/:id/messages` | Send message (SSE stream) |

### Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/files/upload` | Upload a file (PDF, images, text, docx; 50MB limit) |
| `GET` | `/api/files/:id` | Get file metadata |
| `GET` | `/api/files/:id/content` | Get extracted content |
| `DELETE` | `/api/files/:id` | Delete file |

### Knowledge Graph

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/graph/:sessionId` | Get full knowledge graph |
| `GET` | `/api/graph/:sessionId/versions` | List graph versions |
| `GET` | `/api/graph/:sessionId/versions/:version` | Get specific graph version |
| `GET` | `/api/graph/:sessionId/deltas` | Get context evolution timeline |
| `GET` | `/api/graph/:sessionId/deltas/:deltaId` | Get specific delta |
| `GET` | `/api/graph/:sessionId/context` | Get prioritized context (`?minPriority=0.3`) |
| `POST` | `/api/graph/:sessionId/repair-orphans` | Repair orphan nodes via LLM semantic matching |

### Apache AGE / Cypher Queries

Requires `ageEnabled: true` (default).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/graph/:sessionId/age` | Get graph from Apache AGE |
| `GET` | `/api/graph/:sessionId/path` | Find shortest path (`?from=&to=`) |
| `GET` | `/api/graph/:sessionId/paths` | Find all paths (`?from=&to=&maxHops=5`) |
| `GET` | `/api/graph/:sessionId/neighbors/:nodeId` | Get node neighbors (`?direction=both`) |
| `POST` | `/api/graph/:sessionId/cypher` | Execute a read-only Cypher query |

### Domain Extraction

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/graph/domain/extract` | Extract complete domain graph from documentation |
| `POST` | `/api/graph/domain/entities` | Extract entities from documentation |
| `POST` | `/api/graph/domain/processes` | Extract processes/workflows |
| `POST` | `/api/graph/domain/rules` | Extract business rules |

## Database Setup

Requires PostgreSQL. Push the schema:

```bash
# Set DATABASE_URL in .env
npx drizzle-kit push
```

For Apache AGE graph queries, install the [Apache AGE](https://age.apache.org/) extension on your PostgreSQL instance.

## Architecture

- **Claude** — Primary reasoning engine, receives full conversation history + knowledge graph context
- **Gemini** — File extraction only (PDFs, images, documents)
- **mint-format** — Token-efficient formatting for LLM prompts via `@q1k-oss/mint-format`
- **Drizzle ORM** — PostgreSQL schema and queries
- **Apache AGE** — Optional Cypher graph queries (path finding, neighbors, custom queries)
- **Express** — HTTP API with SSE streaming
- **Zod** — Request validation and tool parameter schemas

## License

MIT
