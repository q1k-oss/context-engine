import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';
import { getConfig } from '../config.js';

type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

let _db: DbInstance | null = null;

/**
 * Get the database instance. Lazily initializes on first call using the
 * connection string provided via `initContextEngine()`.
 */
export function getDb(): DbInstance {
  if (!_db) {
    const config = getConfig();
    const client = postgres(config.databaseUrl);
    _db = drizzle(client, { schema });
  }
  return _db;
}
