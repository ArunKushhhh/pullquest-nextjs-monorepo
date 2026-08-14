# apps/worker/src/jobs — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-07-21

## Preferences
- Each processor file handles one queue; import queue name from `../queues/` not hardcoded strings
- Processors call service layer — no direct DB/Redis access in processor files

## Patterns
- `actReset.processor.ts` — BullMQ cron every 45 days: archive leaderboards, drop tier, compress XP, reset earned coins, rebuild Redis sorted sets, create new Act record
- `aiSummary.processor.ts` — Gemini API call, post comment via GitHub App as `pullquestai` bot
- `coinMinting.processor.ts` — BullMQ cron `0 0 1 * *`: credit 100 earned_coins to all active users
- `treasuryAudit.processor.ts` — after each treasury transaction: check debt ceiling −2000, disable staking if breached
- `webhook.processor.ts` — parse GitHub event, dispatch to domain services
- `xp.processor.ts` — compute XP formula, ZADD leaderboard sorted sets, emit Supabase Realtime event

## Gotchas
- Queue names in `../queues/` must exactly match `apps/api/src/config/queues.ts` — mismatch silently drops jobs
- `actReset` must resolve all open stakes before resetting coins — locked coins cannot be reset mid-stake
- `aiSummary` never assigns XP — Gemini output is summary only
- `installation.created` includes granted repos (max 50); worker must upsert them. `installation_repositories.added` only fires when the repo set changes later, not on every install.
- Register stakable issues on `issues.opened` / `reopened` / `labeled`, not labeled-only — creating an issue with labels already applied never sends a later labeled event for those labels.

## Decisions
- Processors are thin orchestrators; business logic lives in `@pullquest/api` services (imported as workspace dep)
