import express, { type Express } from 'express';
import cors from 'cors';
import { chatRouter } from './routes/chat.routes.js';
import { filesRouter } from './routes/files.routes.js';
import { graphRouter } from './routes/graph.routes.js';
import { errorHandler } from './middleware/error-handler.js';

export const app: Express = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/chat', chatRouter);
app.use('/api/files', filesRouter);
app.use('/api/graph', graphRouter);

// Error handler
app.use(errorHandler);
