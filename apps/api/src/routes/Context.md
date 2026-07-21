# apps/api/src/routes — Context

## Purpose
12 Express route files (acts, auth, coins, health, installations, issues, leaderboard, metrics, orgs, prs, stakes, users). HTTP concerns only: parse, validate, delegate, respond.

## Key Files
- `acts.routes.ts`
- `auth.routes.ts`
- `coins.routes.ts`
- `health.routes.ts`
- `installations.routes.ts`
- `issues.routes.ts`
- `leaderboard.routes.ts`
- `metrics.routes.ts`
- `orgs.routes.ts`
- `prs.routes.ts`
- `stakes.routes.ts`
- `users.routes.ts`

## Relationships
Mounted in src/index.ts; delegate all logic to ../services.

## PRD Reference
§6.3 API Endpoints
