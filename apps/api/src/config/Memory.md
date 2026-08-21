# apps/api/src/config — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-08-21

## Preferences
- All env vars accessed via `env.ts` — never `process.env` directly in service/route files
- `env.ts` validates required vars at startup; missing vars throw immediately, not lazily

## Patterns
- `env.ts` — typed env object with validation (throws on missing required vars)
- `queues.ts` — BullMQ queue definitions; queue names must match `apps/worker/src/queues/`
- API enqueues `treasury-audit` / `check-debt-ceiling` after treasury credit or debit
- `redis.ts` — ioredis client singleton for cache/leaderboard
- `sentry.ts` — Sentry SDK init with DSN, environment, release
- `stripe.ts` — Stripe client init with secret key

## Gotchas
- Queue names in `queues.ts` must exactly match worker queue registrations — mismatch silently drops jobs
- `NEO4J_*` vars are for KG scripts only — never imported in API config
- `SUPABASE_SERVICE_ROLE_KEY` is server-only — validated here, never passed to frontend

## Decisions
- Single `env.ts` as source of truth for all config — no scattered `process.env` calls
