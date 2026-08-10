# apps/worker — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-08-09

## Preferences
- Follow patterns in nearest parent Memory.md; workspace imports (@pullquest/*) before external before relative
- TypeScript strict; explicit error handling, never swallow

## Patterns
- Sentry initialized via `src/config/sentry.ts` (no-op when SENTRY_DSN unset); BullMQ `failed` and `error` worker events are captured to Sentry with queue/job context in `index.ts`

## Gotchas
- Worker queue failure counts surface in Prometheus via the API's metrics poller (worker itself exposes no metrics endpoint)

## Decisions
_(add as discovered)_
