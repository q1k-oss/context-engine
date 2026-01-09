# Context Engine

A Context Understanding Engine with Knowledge Graph System. Claude serves as the primary reasoning engine with full conversation history (no summarization), Gemini handles file extraction only, and PostgreSQL persists an evolving versioned knowledge graph.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                     │
│                         Next.js 14+ (App Router)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │    Chat     │  │    File     │  │  Knowledge  │  │   Context   │     │
│  │  Interface  │  │   Upload    │  │   Graph     │  │  Timeline   │     │
│  │ (Streaming) │  │             │  │   Viewer    │  │             │     │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
┌──────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                      │
│                         Node.js + Express                                │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                   Chat Orchestrator Service                      │    │
│  │  - Full history management (NO summarization)                    │    │
│  │  - Prioritized context injection                                 │    │
│  │  - SSE streaming responses                                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │  Claude Client   │  │  Gemini Client   │  │  Graph Builder   │       │
│  │  (Reasoning)     │  │  (Extract Only)  │  │  Service         │       │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘       │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
┌──────────────────────────────────────────────────────────────────────────┐
│                            POSTGRESQL                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  Sessions   │  │  Messages   │  │  Knowledge  │  │   Context   │     │
│  │             │  │  (History)  │  │   Nodes     │  │   Deltas    │     │
│  │             │  │             │  │  (JSONB)    │  │             │     │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │
└──────────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), React 19, TypeScript, Tailwind CSS, React Flow
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with JSONB for flexible graph storage
- **AI**: Claude (reasoning), Gemini (file extraction only)
- **Build**: pnpm workspaces, Turborepo

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for PostgreSQL)

### Setup

1. **Clone and install dependencies**
   ```bash
   cd context-engine
   pnpm install
   ```

2. **Start PostgreSQL**
   ```bash
   docker-compose up -d
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Generate database migrations**
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

## Project Structure

```
context-engine/
├── apps/
│   ├── web/                    # Next.js Frontend
│   │   └── src/
│   │       ├── app/            # App Router pages
│   │       ├── components/     # React components
│   │       │   ├── chat/       # Chat interface
│   │       │   ├── graph/      # Knowledge graph viewer
│   │       │   ├── timeline/   # Evolution timeline
│   │       │   └── ui/         # Reusable UI components
│   │       ├── hooks/          # Custom React hooks
│   │       └── lib/            # Utilities
│   │
│   └── api/                    # Node.js Backend
│       └── src/
│           ├── routes/         # API endpoints
│           ├── services/       # Business logic
│           │   ├── chat/       # Chat orchestration
│           │   ├── llm/        # Claude & Gemini clients
│           │   ├── knowledge-graph/  # Graph building
│           │   └── files/      # File processing
│           └── middleware/     # Express middleware
│
├── packages/
│   ├── db/                     # Database (Drizzle ORM)
│   │   └── src/
│   │       └── schema/         # Table definitions
│   │
│   └── shared/                 # Shared TypeScript types
│       └── src/types/
│
├── docker-compose.yml          # PostgreSQL container
└── turbo.json                  # Turborepo config
```

## Key Features

### Knowledge Graph

- **Node Types**: Entity, Concept, Event, Intent, Decision, Artifact
- **Edge Types**: RELATES_TO, CAUSES, DEPENDS_ON, DECIDED_BY, CONSTRAINED_BY, DERIVED_FROM, TEMPORALLY_PRECEDES
- **B-Tree Indexing**: Priority-based context retrieval
- **JSONB Storage**: Flexible graph properties without migrations

### Context Evolution

- Full conversation history preserved (no summarization)
- Versioned graph snapshots
- Delta tracking for changes
- Timeline visualization

### File Processing

- Gemini extracts content (no reasoning)
- Claude reasons about extracted content
- Supports PDF, images, and documents

## API Endpoints

### Chat
- `POST /api/chat/sessions` - Create session
- `GET /api/chat/sessions/:id` - Get session
- `POST /api/chat/sessions/:id/messages` - Send message (SSE stream)

### Files
- `POST /api/files/upload` - Upload file
- `GET /api/files/:id` - Get file metadata
- `GET /api/files/:id/content` - Get extracted content

### Graph
- `GET /api/graph/:sessionId` - Get current graph
- `GET /api/graph/:sessionId/versions` - List versions
- `GET /api/graph/:sessionId/deltas` - Get evolution timeline

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

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Technical Design Decisions

### Why B-Trees for Context Prioritization
PostgreSQL's B-Tree index on `priority_score` enables O(log n) lookups, efficient range queries for "top N priority items", and natural rebalancing as priorities update.

### Why JSONB for Graph Storage
Schema flexibility allows graph structures to evolve without migrations. GIN indexes support containment and existence operators. Partial updates modify specific paths without replacing entire documents.

### When DB Writes Are Triggered
- **Always write**: New messages, sessions, file uploads
- **Batch write**: Graph updates (debounced after message processing)
- **Skip write**: Temporary streaming state, unchanged priorities
- **Version snapshot**: Every N messages or significant delta threshold

## License

MIT
