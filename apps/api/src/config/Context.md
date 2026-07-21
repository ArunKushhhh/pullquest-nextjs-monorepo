# apps/api/src/config — Context

## Purpose
Environment validation, Redis/Sentry/Stripe client setup, BullMQ queue definitions for the API.

## Key Files
- `env.ts`
- `queues.ts`
- `redis.ts`
- `sentry.ts`
- `stripe.ts`

## Relationships
env.ts validated at boot; queues.ts names must match apps/worker queue registrations exactly.

## PRD Reference
§6.3 API server, §6.5 Redis, §8.3 Sentry
