import express, { type Express } from 'express';
import cors from 'cors';
import { chatRouter } from './routes/chat.routes.js';
import { graphRouter } from './routes/graph.routes.js';
import { errorHandler } from './middleware/error-handler.js';

export interface CreateAppOptions {
  /** CORS origin (default: 'http://localhost:3000') */
  corsOrigin?: string | string[];
}

/**
 * Create a configured Express app with all Context Engine routes.
 * Call `initContextEngine()` before calling this.
 */
export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();

  // Middleware
  app.use(cors({
    origin: options.corsOrigin || 'http://localhost:3000',
    credentials: true,
  }));
  app.use(express.json());

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  // NOTE: the file-upload route was removed (ADR-037) — document ingestion is
  // now driven by q1k-controlplane's Temporal worker, which imports this package
  // as a library (extractFromFile / structureToMint / chunkDocument) rather than
  // POSTing to an HTTP endpoint. context-engine no longer orchestrates ingestion.
  app.use('/api/chat', chatRouter);
  app.use('/api/graph', graphRouter);

  // Error handler
  app.use(errorHandler);

  return app;
}
