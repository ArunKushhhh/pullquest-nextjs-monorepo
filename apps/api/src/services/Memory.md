# apps/api/src/services — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-08-17

## Preferences
- Stateless functions, not classes — no singleton state in services
- Workspace imports first: `@pullquest/shared`, `@pullquest/database`, then external, then relative
- TypeScript strict; explicit error handling, never swallow silently
- All config via `../config/env.ts` — never `process.env` directly in service files

## Patterns
- One service file per domain entity: act, auth, coin, credibility, evaluation, installation, issue, leaderboard, org, pr, stake, treasury, user, webhook, xp
- XP formula lives in `@pullquest/shared/utils` — services call it, never re-implement
- Leaderboard writes: `ZADD leaderboard:global:act:{actId}` and `leaderboard:org:{orgId}:act:{actId}`
- Treasury debt ceiling check after every debit — disable staking if balance < −2000
- Coin tracking: `earned_coins` and `purchased_coins` stored separately; purchased never reset on Act reset
- Stake rules live in `@pullquest/shared` `evaluateStakeAttempt` — exact Stake-X, open issue, band, uniqueness, treasury gate
- After a successful stake: lock coins, insert `stakes`, `HSET cache:issue:{id}` (2m), `HSET session:{userId}` active_stakes (30m)

## Gotchas
- `EvaluationService` must block merge path — XP cannot be calculated without evaluation score
- `PRService` rejection trigger: PR closed unmerged AND latest review is `changes_requested`
- `PRService` closed-without-merge trigger: PR closed unmerged AND no `changes_requested` review exists
- Trust multiplier uses highest applicable bracket (not additive) — PRD §2.4
- `ActService` reset runs in BullMQ job, not HTTP request — no response timeout concern
- `LeaderboardService` must publish Supabase Realtime event after every ZADD
- `POST /api/issues/:id/stake` amount must equal `issues.stake_amount` — difficulty-band-only amounts are rejected
- `StakeError` maps to 400/403/404/409; unique `(user_id, issue_id)` is a 409 even on races

## Decisions
- Flat functions over classes for simplicity; revisit if service complexity grows
- `CredibilityService` caches result in Redis with 15-min TTL — never compute on every request
- `AIService` never assigns XP — Gemini only generates summaries, posts via GitHub App bot
