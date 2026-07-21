# apps/api/src/ — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-07-21

## Preferences
- Barrel exports from `index.ts` for clean imports
- Services are stateless classes/functions — no singleton state
- All config accessed via `config/env.ts` validated environment variables

## Patterns
- Route files only handle HTTP concerns (parsing params, sending responses)
- Service files contain all business logic and DB queries
- One route file per domain entity (coins, issues, prs, users, etc.)
- One service file per domain entity, plus cross-cutting services (credibility, evaluation, xp, treasury)
- Webhook handlers are separate from REST routes
- Redis utilities split by concern: generic cache vs. leaderboard-specific sorted sets

## Gotchas
- `metrics/definitions.ts` must be imported before metrics middleware to register counters
- Queue names in `config/queues.ts` must exactly match worker queue registrations in `apps/worker/`
- Supabase client created per-request using service role key for admin ops
- Error handler middleware must be registered LAST in Express middleware chain

## Decisions
- Flat service files (not classes) for simplicity — may refactor to classes if complexity grows
- Separate webhooks directory to isolate third-party event handling from REST API
- Redis leaderboard uses sorted sets for O(log N) rank queries
