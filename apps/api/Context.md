# apps/api/ — Context

## Purpose
Express.js REST API server (port 3001) that handles authentication, GitHub webhooks, coin/XP economy, leaderboards, and all backend business logic for the PullQuest platform.

## Key Files
- `src/index.ts` — Express app entrypoint, registers routes and middleware
- `src/routes/` — Route definitions: auth, coins, issues, leaderboard, orgs, prs, users, stakes, acts, installations, metrics, health
- `src/services/` — Business logic: auth, coin, credibility, evaluation, installation, issue, leaderboard, org, pr, stake, treasury, user, webhook, xp
- `src/middleware/` — auth.ts, errorHandler.ts, metrics.ts, rateLimiter.ts
- `src/webhooks/` — github.webhook.ts, stripe.webhook.ts
- `src/metrics/` — Prometheus metric definitions
- `src/redis/` — cache.ts, leaderboard.ts (Redis-backed caching & sorted sets)
- `src/config/` — env.ts, queues.ts, redis.ts, sentry.ts, stripe.ts
- `Dockerfile` — Production container build
- `package.json` — @pullquest/api, depends on express, ioredis, bullmq, stripe, prom-client, sentry, jsonwebtoken
- `tsconfig.json` — TypeScript configuration

## Dependencies
- `@pullquest/shared` (workspace) — shared types, enums, constants, utils
- `@pullquest/database` (workspace) — Supabase client and DB types
- External: Express, ioredis, BullMQ, Stripe, prom-client, Sentry, jsonwebtoken
- Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, REDIS_URL, STRIPE_SECRET_KEY, SENTRY_DSN, JWT_SECRET, GITHUB_WEBHOOK_SECRET

## Relationships
- Receives HTTP requests from `apps/web/` (Next.js frontend)
- Enqueues background jobs to `apps/worker/` via BullMQ/Redis
- Exposes `/metrics` endpoint scraped by Prometheus (infra/prometheus)
- Processes GitHub and Stripe webhooks

## PRD Reference
- Implements: REST API layer, authentication, GitHub App integration, coin economy, XP system, leaderboards, staking, treasury management
