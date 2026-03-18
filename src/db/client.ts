import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';
import { getConfig } from '../config.js';

type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

let _db: DbInstance | null = null;

/**
 * Get the database instance. Lazily initializes on first call using the
 * connection string provided via `initContextEngine()`.
 *
 * Configures connection pooling via `dbPoolSize` and `dbIdleTimeout`.
 */
export function getDb(): DbInstance {
  if (!_db) {
    const config = getConfig();
    const client = postgres(config.databaseUrl, {
      max: config.dbPoolSize ?? 10,
      idle_timeout: config.dbIdleTimeout ?? 30,
      connect_timeout: 10,
    });
    _db = drizzle(client, { schema });
  }
  return _db;
}
