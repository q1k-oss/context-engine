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

| Option | Required | Description |
|--------|----------|-------------|
| `databaseUrl` | Yes | PostgreSQL connection string |
| `anthropicApiKey` | No | Anthropic API key for Claude |
| `googleAiApiKey` | No | Google AI API key for Gemini (file extraction) |
| `ageEnabled` | No | Enable Apache AGE graph extensions (default: `true`) |
| `uploadDir` | No | Directory for file uploads (default: `./uploads`) |

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

## Subpath Imports

Import only what you need:

```ts
import { createApp } from '@q1k-oss/context-engine/app';
import { getDb } from '@q1k-oss/context-engine/db';
import { sessions, knowledgeNodes } from '@q1k-oss/context-engine/db/schema';
import type { Session, KnowledgeNode } from '@q1k-oss/context-engine/types';
```

## API Endpoints

When using `createApp()`, these routes are available:

### Chat
- `POST /api/chat/sessions` — Create a session
- `GET /api/chat/sessions` — List sessions
- `GET /api/chat/sessions/:id` — Get session with messages
- `DELETE /api/chat/sessions/:id` — Delete session
- `POST /api/chat/sessions/:id/messages` — Send message (SSE stream)

### Files
- `POST /api/files/upload` — Upload a file for processing
- `GET /api/files/:id` — Get file metadata
- `GET /api/files/:id/content` — Get extracted content
- `DELETE /api/files/:id` — Delete file

### Knowledge Graph
- `GET /api/graph/:sessionId` — Get knowledge graph
- `GET /api/graph/:sessionId/versions` — List graph versions
- `GET /api/graph/:sessionId/deltas` — Get context evolution timeline
- `GET /api/graph/:sessionId/context` — Get prioritized context
- `POST /api/graph/:sessionId/repair-orphans` — Repair orphan nodes
- `POST /api/graph/domain/extract` — Extract domain graph from documentation
- `POST /api/graph/domain/entities` — Extract entities
- `POST /api/graph/domain/processes` — Extract processes
- `POST /api/graph/domain/rules` — Extract business rules

## Database Setup

Requires PostgreSQL. Push the schema:

```bash
# Set DATABASE_URL in .env
npx drizzle-kit push
```

## Architecture

- **Claude** — Primary reasoning engine, receives full conversation history
- **Gemini** — File extraction only (PDFs, images, documents)
- **Drizzle ORM** — PostgreSQL schema and queries
- **Apache AGE** — Optional Cypher graph queries
- **Express** — HTTP API with SSE streaming

## License

MIT
