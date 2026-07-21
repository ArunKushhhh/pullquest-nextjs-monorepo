# apps/api/ — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-07-21

## Preferences
- TypeScript strict mode enabled
- Route → Service pattern (routes handle HTTP, services handle business logic)
- Supabase service role key used for admin operations (bypasses RLS)
- `tsx watch` for development hot-reload

## Patterns
- Routes are named `*.routes.ts`, services are named `*.service.ts`
- Middleware applies globally or per-route (auth, rate limiting, metrics, error handling)
- Config centralized in `src/config/` — env validation, Redis config, queue names, Stripe/Sentry setup
- Redis used for both caching (`cache.ts`) and leaderboard sorted sets (`leaderboard.ts`)
- BullMQ queues defined in `src/config/queues.ts`, jobs processed by `apps/worker/`
- Webhooks have dedicated directory (`src/webhooks/`) separate from routes

## Gotchas
- The `.env` file in this directory is a symlink/copy of the root `.env` — keep them in sync
- Stripe webhook verification requires raw body — ensure body parser doesn't interfere
- GitHub webhook signature verification uses GITHUB_WEBHOOK_SECRET
- Rate limiter uses Redis for distributed rate limiting across instances
- Prometheus metrics middleware must be registered before routes to capture all requests

## Decisions
- Express over Fastify for ecosystem maturity and middleware availability
- jsonwebtoken for JWT handling (Supabase tokens validated server-side)
- Sentry for error tracking in production
- prom-client for Prometheus-compatible metrics
- BullMQ over raw Redis pub/sub for reliable job processing with retries
