import { Request, Response, NextFunction } from 'express';
import { Sentry } from '../config/sentry.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error('[Error Handler]:', err);

  // Capture in Sentry if configured
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }

  res.status(statusCode).json({
    error: err.name || 'InternalServerError',
    message,
    statusCode,
  });
}
