# apps/api/src/middleware — Context

## Purpose
Express middleware: JWT auth validation, error handler, Prometheus metrics, rate limiter.

## Key Files
- `auth.ts`
- `errorHandler.ts`
- `metrics.ts`
- `rateLimiter.ts`

## Relationships
Wraps all routes in index.ts; errorHandler must register LAST.

## PRD Reference
§6.3 Middleware Stack
