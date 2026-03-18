/**
 * Central configuration for the Context Engine SDK.
 *
 * Consumers must call `initContextEngine(config)` before using any services.
 */

export interface ContextEngineConfig {
  /** PostgreSQL connection string */
  databaseUrl: string;
  /** Anthropic API key for Claude */
  anthropicApiKey?: string;
  /** Google AI API key for Gemini (used for file extraction only) */
  googleAiApiKey?: string;
  /** Enable Apache AGE graph extensions (default: true) */
  ageEnabled?: boolean;
  /** Directory for file uploads (default: './uploads') */
  uploadDir?: string;
  /** Claude model for reasoning/extraction (default: 'claude-sonnet-4-20250514') */
  claudeModel?: string;
  /** Gemini model for file extraction (default: 'gemini-2.0-flash-exp') */
  geminiModel?: string;
  /** PostgreSQL connection pool size (default: 10) */
  dbPoolSize?: number;
  /** PostgreSQL connection idle timeout in seconds (default: 30) */
  dbIdleTimeout?: number;
}

let _config: ContextEngineConfig | null = null;

/**
 * Initialize the Context Engine SDK with your configuration.
 * Must be called before using any services, database, or app factory.
 */
export function initContextEngine(config: ContextEngineConfig): void {
  _config = config;
}

/**
 * Get the current configuration. Throws if `initContextEngine()` has not been called.
 */
export function getConfig(): ContextEngineConfig {
  if (!_config) {
    throw new Error(
      'Context Engine not initialized. Call initContextEngine({ databaseUrl: "..." }) before using any services.'
    );
  }
  return _config;
}
