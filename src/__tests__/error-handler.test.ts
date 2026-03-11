import { describe, it, expect } from 'vitest';
import { AppError } from '../middleware/error-handler.js';

describe('AppError', () => {
  it('creates error with all fields', () => {
    const err = new AppError('NOT_FOUND', 'Session not found', 404, { id: '123' });
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Session not found');
    expect(err.statusCode).toBe(404);
    expect(err.details).toEqual({ id: '123' });
    expect(err.name).toBe('AppError');
  });

  it('defaults statusCode to 500', () => {
    const err = new AppError('INTERNAL', 'Something went wrong');
    expect(err.statusCode).toBe(500);
  });

  it('is instance of Error', () => {
    const err = new AppError('TEST', 'test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it('details is optional', () => {
    const err = new AppError('TEST', 'test', 400);
    expect(err.details).toBeUndefined();
  });
});
