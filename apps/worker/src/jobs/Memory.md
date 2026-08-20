# apps/worker/src/jobs — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-08-20

## Preferences
- Each processor file handles one queue; import queue name from `../queues/` not hardcoded strings
- Processors call service layer — no direct DB/Redis access in processor files

## Patterns
- `actReset.processor.ts` — BullMQ cron every 45 days: archive leaderboards, drop tier, compress XP, reset earned coins, rebuild Redis sorted sets, create new Act record
- `aiSummary.processor.ts` — Gemini API call, post comment via GitHub App as `pullquestai` bot
- `coinMinting.processor.ts` — BullMQ cron `0 0 1 * *`: credit 100 earned_coins to all active users
- `treasuryAudit.processor.ts` — after each treasury transaction: check debt ceiling −2000, disable staking if breached
- `webhook.processor.ts` — parse GitHub event, dispatch to domain services. `pull_request` / `pull_request_review` are handled by API `PRService`, not this processor.
- `xp.processor.ts` — skip only; XP + leaderboard writes happen in API `XPService` on evaluate

## Gotchas
- Queue names in `../queues/` must exactly match `apps/api/src/config/queues.ts` — mismatch silently drops jobs
- `actReset` must resolve all open stakes before resetting coins — locked coins cannot be reset mid-stake
- `aiSummary` never assigns XP — Gemini output is summary only
- `installation.created` includes granted repos (max 50); worker must upsert them. `installation_repositories.added` only fires when the repo set changes later, not on every install.
- Register stakable issues on `issues.opened` / `reopened` / `labeled`, not labeled-only — creating an issue with labels already applied never sends a later labeled event for those labels.
- Both difficulty and exact `Stake-N` are required; do not default amount to the band minimum. `unlabeled` closes the issue if either is gone.
- Label parsing lives in `@pullquest/shared` `parseStakeLabels` — `Stake-Easy` is difficulty, `Stake-50` is amount.
- Do not re-implement PR refund/deduction/bonus here — that double-pays if a stale job and the API both run.

## Decisions
- Processors are thin orchestrators; PR lifecycle business logic lives in `apps/api/src/services/pr.service.ts`
