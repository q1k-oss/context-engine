import type { ErrorRequestHandler } from 'express';
import type { ApiError } from '@context-engine/shared';

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (err instanceof AppError) {
    const error: ApiError = {
      code: err.code,
      message: err.message,
      details: err.details,
    };
    res.status(err.statusCode).json({ success: false, error });
    return;
  }

  // Generic error
  const error: ApiError = {
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
  };
  res.status(500).json({ success: false, error });
};
