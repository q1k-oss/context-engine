/**
 * Standalone server entry point.
 * Reads configuration from environment variables and starts the Express server.
 *
 * Usage: node dist/server.js
 */
import dotenv from 'dotenv';
dotenv.config();

import { initContextEngine } from './config.js';
import { createApp } from './app.js';

initContextEngine({
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/context_engine',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  googleAiApiKey: process.env.GOOGLE_AI_API_KEY,
  ageEnabled: process.env.AGE_ENABLED !== 'false',
  uploadDir: process.env.UPLOAD_DIR || './uploads',
});

const app = createApp({
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
});

const PORT = process.env.API_PORT || 3001;

app.listen(PORT, () => {
  console.log(`Context Engine API running on http://localhost:${PORT}`);
});
