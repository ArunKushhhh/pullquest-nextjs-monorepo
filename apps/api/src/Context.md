# apps/api/src/ — Context

## Purpose
Source code root for the Express.js API. Contains the server entrypoint, all route handlers, business logic services, middleware, webhook processors, metrics definitions, Redis utilities, and configuration.

## Key Files
- `index.ts` — Express app setup: middleware registration, route mounting, server startup on port 3001
- `routes/` — 12 route files: acts, auth, coins, health, installations, issues, leaderboard, metrics, orgs, prs, stakes, users
- `services/` — 15 service files: act, auth, coin, credibility, evaluation, installation, issue, leaderboard, org, pr, stake, treasury, user, webhook, xp
- `middleware/` — auth.ts (JWT validation), errorHandler.ts, metrics.ts (Prometheus), rateLimiter.ts
- `webhooks/` — github.webhook.ts (PR/issue events), stripe.webhook.ts (payment events)
- `metrics/` — definitions.ts (Prometheus counter/histogram definitions)
- `redis/` — cache.ts (generic cache), leaderboard.ts (sorted set leaderboard)
- `config/` — env.ts, queues.ts, redis.ts, sentry.ts, stripe.ts

## Dependencies
- `@pullquest/shared` — types, enums, constants
- `@pullquest/database` — Supabase client factory, DB types
- External: express, cors, ioredis, bullmq, stripe, prom-client, @sentry/node, jsonwebtoken, dotenv

## Relationships
- `index.ts` imports and mounts all routes from `routes/`
- Routes delegate to services; services use `@pullquest/database` for DB access
- Services enqueue jobs via BullMQ queues (defined in `config/queues.ts`)
- Middleware wraps all routes for auth, error handling, rate limiting, metrics

## PRD Reference
- Core backend implementation: all API endpoints, webhook processing, economy logic
