# apps/api/src/services — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-08-21

## Preferences
- Stateless functions, not classes — no singleton state in services
- Workspace imports first: `@pullquest/shared`, `@pullquest/database`, then external, then relative
- TypeScript strict; explicit error handling, never swallow silently
- All config via `../config/env.ts` — never `process.env` directly in service files

## Patterns
- One service file per domain entity: act, auth, coin, credibility, evaluation, installation, issue, leaderboard, org, pr, stake, treasury, user, webhook, xp
- XP formula lives in `@pullquest/shared/utils` — services call it, never re-implement
- Leaderboard writes: `ZADD leaderboard:global:{actId}` and `leaderboard:org:{orgId}:{actId}` (no `act:` infix)
- Treasury debt ceiling check after every debit — disable staking if balance < −2000
- `GET /api/orgs/:orgId/treasury` is installer/org-admin only; public org dashboard must not include raw balance
- After credit/debit, enqueue `treasury-audit` `check-debt-ceiling` and set `pullquest_treasury_balance`
- Coin tracking: `earned_coins` and `purchased_coins` stored separately; purchased never reset on Act reset
- Bundles live in `@pullquest/shared` `COIN_BUNDLES`; `POST /api/coins/create-checkout-session` 409s if that pack was already bought this Act
- Stake rules live in `@pullquest/shared` `evaluateStakeAttempt` — exact Stake-X, open issue, band, uniqueness, treasury gate
- After a successful stake: lock coins, insert `stakes`, `HSET cache:issue:{id}` (2m), `HSET session:{userId}` active_stakes (30m)
- PR outcomes live in `@pullquest/shared` `classifyPROutcome` + `computePRFinancials` — API `PRService` applies them; worker does not
- GitHub `pull_request` / `pull_request_review` are handled in-process by `handlePullRequestGitHubEvent`, not the webhook queue

## Gotchas
- `EvaluationService` must block merge path — XP cannot be calculated without evaluation score
- `PRService` rejection trigger: PR closed unmerged AND latest review is `changes_requested`
- `PRService` closed-without-merge trigger: PR closed unmerged AND a review exists that is not `changes_requested`
- `PRService` unreviewed trigger: PR closed unmerged AND `last_review_status` is null — full refund, no 30% compensation
- Linking a PR requires `#N` in title or body AND a LOCKED stake on that issue for the author
- Multiple Accepted splits `MERGE_BONUS` with `floor(bonus / acceptedCount)`; XP split is still §2.4
- Trust multiplier uses highest applicable bracket (not additive) — PRD §2.4
- `ActService` reset runs in BullMQ job, not HTTP request — no response timeout concern
- `LeaderboardService` hides Unranked users, `ZREM`s ghost Redis members, hydrates from DB if the sorted set was evicted, and returns `me` standing when the request is authenticated
- Realtime leaderboard events are a separate Frontend feature — do not block Tiers on them
- `POST /api/issues/:id/stake` amount must equal `issues.stake_amount` — difficulty-band-only amounts are rejected
- `StakeError` maps to 400/403/404/409; unique `(user_id, issue_id)` is a 409 even on races
- Only `installations.installed_by` may evaluate a PR — not every org member
- `ensureActiveAct()` boots Act 1 (45 days) on first XP award if `acts` is empty; `xp_logs.act_id` is required
- `GET /api/acts/current` adds `days_remaining` and `duration_days`
- `POST /api/acts/reset` enqueues `{ force: true }` on `act-management`; development or PLATFORM_ADMIN only
- Award XP in `XPService` during evaluate; skip `xp.processor` so queued jobs cannot double-pay
- Skip `xp_logs` insert when a row already exists for `pr_id` (unique index may not be applied on remote yet)
- Org board uses `ZINCRBY` by awarded XP; global board `ZADD`s `users.global_xp`

## Decisions
- Flat functions over classes for simplicity; revisit if service complexity grows
- `CredibilityService` caches result in Redis with 15-min TTL — never compute on every request
- `AIService` never assigns XP — Gemini only generates summaries, posts via GitHub App bot
