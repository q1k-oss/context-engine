import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initContextEngine, getConfig } from '../config.js';

// Since config is module-level mutable state, we need to reset it between tests.
// We do this by re-initializing with known values and testing the "uninitialized" case first.

describe('initContextEngine & getConfig', () => {
  it('returns config after initialization', () => {
    initContextEngine({
      databaseUrl: 'postgresql://localhost:5432/test',
      anthropicApiKey: 'sk-test-123',
    });

    const config = getConfig();
    expect(config.databaseUrl).toBe('postgresql://localhost:5432/test');
    expect(config.anthropicApiKey).toBe('sk-test-123');
  });

  it('overwrites config on re-initialization', () => {
    initContextEngine({
      databaseUrl: 'postgresql://localhost/first',
    });

    initContextEngine({
      databaseUrl: 'postgresql://localhost/second',
      anthropicApiKey: 'sk-new',
    });

    const config = getConfig();
    expect(config.databaseUrl).toBe('postgresql://localhost/second');
    expect(config.anthropicApiKey).toBe('sk-new');
  });

  it('returns all config fields when fully specified', () => {
    initContextEngine({
      databaseUrl: 'postgresql://localhost/db',
      anthropicApiKey: 'sk-ant',
      googleAiApiKey: 'goog-key',
      ageEnabled: false,
      uploadDir: '/tmp/uploads',
    });

    const config = getConfig();
    expect(config.databaseUrl).toBe('postgresql://localhost/db');
    expect(config.anthropicApiKey).toBe('sk-ant');
    expect(config.googleAiApiKey).toBe('goog-key');
    expect(config.ageEnabled).toBe(false);
    expect(config.uploadDir).toBe('/tmp/uploads');
  });

  it('preserves undefined for omitted optional fields', () => {
    initContextEngine({ databaseUrl: 'postgresql://localhost/db' });

    const config = getConfig();
    expect(config.databaseUrl).toBe('postgresql://localhost/db');
    expect(config.googleAiApiKey).toBeUndefined();
    expect(config.ageEnabled).toBeUndefined();
    expect(config.uploadDir).toBeUndefined();
  });
});
