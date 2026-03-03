# Context Engine

A Context Understanding Engine with Knowledge Graph System. Claude serves as the primary reasoning engine with full conversation history (no summarization), Gemini handles file extraction only, and PostgreSQL with Apache AGE persists an evolving versioned knowledge graph with Cypher query support.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
│                         Next.js 15 (App Router)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │    Chat      │  │    File     │  │  Knowledge  │  │   Context   │    │
│  │  Interface   │  │   Upload    │  │   Graph     │  │  Timeline   │    │
│  │ (Streaming)  │  │             │  │   Viewer    │  │             │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
┌──────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                     │
│                         Node.js + Express                                │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                   Chat Orchestrator Service                      │    │
│  │  - Full history management (NO summarization)                    │    │
│  │  - Prioritized context injection                                 │    │
│  │  - SSE streaming responses                                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ Claude Client│ │ Gemini Client│ │ Graph Builder│ │ Domain       │   │
│  │ (Reasoning)  │ │ (Extract)    │ │ Service      │ │ Extractor    │   │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                   MCP Server (Model Context Protocol)            │    │
│  │  - Claude graph manipulation tools (node/edge/alias CRUD)        │    │
│  │  - Graph-level operations and queries                            │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
┌──────────────────────────────────────────────────────────────────────────┐
│                     POSTGRESQL + Apache AGE                               │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ │
│  │ Sessions  │ │ Messages  │ │ Knowledge │ │  Context  │ │   Graph   │ │
│  │           │ │ (History) │ │  Nodes    │ │  Deltas   │ │ Versions  │ │
│  │           │ │           │ │  (JSONB)  │ │           │ │           │ │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘ │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐                             │
│  │  Edges    │ │   Node    │ │   Files   │   + Apache AGE for Cypher   │
│  │           │ │  Aliases  │ │           │     graph traversal queries  │
│  └───────────┘ └───────────┘ └───────────┘                             │
└──────────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, React Force Graph 2D, D3-Force
- **Backend**: Node.js 20+, Express 4, TypeScript
- **Database**: PostgreSQL 16 with Apache AGE (Cypher graph queries), JSONB for flexible graph storage
- **AI**: Claude via Anthropic SDK (reasoning), Gemini via Google AI SDK (file extraction only)
- **MCP**: Model Context Protocol server for Claude graph tool access
- **Build**: pnpm 9 workspaces, Turborepo

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for PostgreSQL with Apache AGE)

### Setup

1. **Clone and install dependencies**
   ```bash
   cd context-engine
   pnpm install
   ```

2. **Start PostgreSQL with Apache AGE**
   ```bash
   docker-compose up -d
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Run database migrations**
   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

5. **Start development servers**
   ```bash
   pnpm dev
   ```

   This starts:
   - Frontend: http://localhost:3000
   - API: http://localhost:3001

### Available Scripts

```bash
pnpm dev           # Start all dev servers (frontend + API)
pnpm build         # Build all packages
pnpm test          # Run tests across workspace
pnpm lint          # Lint all packages
pnpm clean         # Clean build artifacts
pnpm db:generate   # Generate Drizzle migrations
pnpm db:migrate    # Run migrations
pnpm db:studio     # Open Drizzle Studio (DB GUI)
```

## Project Structure

```
context-engine/
├── apps/
│   ├── web/                    # Next.js 15 Frontend
│   │   └── src/
│   │       ├── app/            # App Router pages
│   │       ├── components/     # React components
│   │       │   ├── chat/       # Chat interface, file upload
│   │       │   ├── graph/      # Knowledge graph viewer
│   │       │   ├── timeline/   # Evolution timeline
│   │       │   └── ui/         # Reusable UI components
│   │       ├── hooks/          # Custom React hooks
│   │       └── lib/            # API client, utilities
│   │
│   └── api/                    # Node.js Backend
│       └── src/
│           ├── routes/         # API endpoints
│           ├── services/       # Business logic
│           │   ├── chat/       # Chat orchestration
│           │   ├── llm/        # Claude & Gemini clients
│           │   ├── knowledge-graph/  # Graph building, entity & domain extraction
│           │   ├── graph/      # Apache AGE client
│           │   └── files/      # File processing
│           └── middleware/     # Express middleware
│
├── packages/
│   ├── db/                     # Database layer (Drizzle ORM)
│   │   └── src/
│   │       ├── schema/         # Table definitions
│   │       └── migrations/     # SQL migrations
│   │
│   ├── shared/                 # Shared TypeScript types
│   │   └── src/types/          # Chat, graph, API, file, workflow & domain schemas
│   │
│   └── mcp-server/             # Model Context Protocol server
│       └── src/
│           ├── tools/          # Tool definitions (node, edge, graph, alias)
│           └── operations/     # Tool implementations
│
├── docker-compose.yml          # PostgreSQL + Apache AGE container
├── turbo.json                  # Turborepo config
└── pnpm-workspace.yaml         # Workspace config
```

## Key Features

### Knowledge Graph

- **Node Types**: Entity, Concept, Event, Intent, Decision, Artifact
- **Edge Types**: RELATES_TO, CAUSES, DEPENDS_ON, DECIDED_BY, CONSTRAINED_BY, DERIVED_FROM, TEMPORALLY_PRECEDES, CO_OCCURS, SUPERSEDES, EVIDENCE_FOR
- **B-Tree Indexing**: Priority-based context retrieval with O(log n) lookups
- **JSONB Storage**: Flexible graph properties with GIN indexes
- **Entity Aliases**: Deduplication and resolution across conversations
- **Versioned Snapshots**: Full graph state captured at intervals
- **Delta Tracking**: Change history between versions

### Apache AGE Integration

- Cypher query support for graph traversal
- Shortest path and multi-hop path finding between nodes
- Directional neighbor discovery (in/out/both)
- Custom Cypher queries (read-only via API)
- Orphan node detection and LLM-based semantic repair

### Domain Extraction

- Extract full domain knowledge graphs from documentation
- Entity extraction (people, organizations, concepts)
- Process and workflow extraction
- Business rule extraction
- Two extraction schemas: Workflow-based and Domain-based

### Context Evolution

- Full conversation history preserved (no summarization)
- Versioned graph snapshots
- Delta tracking for changes
- Timeline visualization

### File Processing

- Gemini extracts content (structure, entities, metadata — no reasoning)
- Claude reasons about extracted content
- Supported formats: PDF, PNG, JPEG, GIF, WebP, plain text, DOC, DOCX
- 50MB file size limit

### MCP Server

- Model Context Protocol server for programmatic graph access
- Node CRUD tools (create, read, update, delete)
- Edge CRUD tools
- Graph-level operations and queries
- Entity alias management
- Runs via stdio transport (`context-engine-mcp`)

## API Endpoints

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat/sessions` | Create a new session |
| `GET` | `/api/chat/sessions` | List all sessions |
| `GET` | `/api/chat/sessions/:id` | Get session with messages |
| `DELETE` | `/api/chat/sessions/:id` | Delete a session |
| `POST` | `/api/chat/sessions/:id/messages` | Send message (SSE stream) |

### Files
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/files/upload` | Upload a file (multipart, field: `file`) |
| `GET` | `/api/files/:id` | Get file metadata |
| `GET` | `/api/files/:id/content` | Get extracted content |
| `DELETE` | `/api/files/:id` | Delete a file |

### Graph
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/graph/:sessionId` | Get current knowledge graph |
| `GET` | `/api/graph/:sessionId/versions` | List graph versions |
| `GET` | `/api/graph/:sessionId/versions/:version` | Get a specific version |
| `GET` | `/api/graph/:sessionId/deltas` | Get evolution timeline |
| `GET` | `/api/graph/:sessionId/deltas/:deltaId` | Get a specific delta |
| `GET` | `/api/graph/:sessionId/context` | Get prioritized context (debug) |

### Graph — Apache AGE / Cypher
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/graph/:sessionId/age` | Get graph from Apache AGE |
| `GET` | `/api/graph/:sessionId/path` | Shortest path (`?from=&to=`) |
| `GET` | `/api/graph/:sessionId/paths` | All paths (`?from=&to=&maxHops=`) |
| `GET` | `/api/graph/:sessionId/neighbors/:nodeId` | Node neighbors (`?direction=`) |
| `POST` | `/api/graph/:sessionId/cypher` | Execute read-only Cypher query |
| `POST` | `/api/graph/:sessionId/repair-orphans` | Repair orphan nodes via LLM |

### Graph — Domain Extraction
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/graph/domain/extract` | Extract full domain graph from docs |
| `POST` | `/api/graph/domain/entities` | Extract entities from docs |
| `POST` | `/api/graph/domain/processes` | Extract processes/workflows |
| `POST` | `/api/graph/domain/rules` | Extract business rules |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |

## Database Schema

| Table | Purpose |
|-------|---------|
| `sessions` | Chat session records |
| `messages` | Full conversation history (sequenced, no summarization) |
| `knowledge_nodes` | Graph nodes with JSONB properties and priority scores |
| `knowledge_edges` | Relationships between nodes |
| `graph_versions` | Versioned snapshots of the complete graph |
| `context_deltas` | Change tracking between versions |
| `node_aliases` | Alternative names for entity resolution |
| `files` | Uploaded file metadata and extracted content |

## Environment Variables

```env
# PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/context_engine

# Claude (Anthropic)
ANTHROPIC_API_KEY=sk-ant-...

# Gemini (Google AI)
GOOGLE_AI_API_KEY=...

# Server
API_PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Technical Design Decisions

### Why B-Trees for Context Prioritization
PostgreSQL's B-Tree index on `priority_score` enables O(log n) lookups, efficient range queries for "top N priority items", and natural rebalancing as priorities update.

### Why JSONB for Graph Storage
Schema flexibility allows graph structures to evolve without migrations. GIN indexes support containment and existence operators. Partial updates modify specific paths without replacing entire documents.

### Why Apache AGE for Graph Queries
Native Cypher query support within PostgreSQL — no separate graph database needed. Enables path finding, neighbor traversal, and pattern matching directly on the knowledge graph.

### Why Dual AI (Claude + Gemini)
Separation of concerns: Gemini handles file content extraction (structure, entities, metadata) while Claude handles all reasoning with full conversation context. This keeps extraction costs low and reasoning quality high.

### Why No Summarization
Full conversation history is sent to Claude every time to preserve context richness. This avoids information loss from summarization at the cost of higher token usage.

### When DB Writes Are Triggered
- **Always write**: New messages, sessions, file uploads
- **Batch write**: Graph updates (debounced after message processing)
- **Skip write**: Temporary streaming state, unchanged priorities
- **Version snapshot**: Every N messages or significant delta threshold

## License

MIT
