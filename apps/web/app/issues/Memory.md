# apps/web/app/issues — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-08-17

## Preferences
- Server component for list fetch; client component only for stake action button
- Fetch from `GET /api/issues?org=&difficulty=&status=` — not direct Supabase

## Patterns
- Each issue card shows: stake amount, difficulty band, org credibility score, trust multiplier
- Stake action: `POST /api/issues/:id/stake { amount }` where `amount` is exactly `issue.stake_amount` — no slider
- Filter by difficulty (Easy/Medium/Hard) and status (open/staked/resolved)

## Gotchas
- Issue only appears if it has valid `Stake-X` label AND difficulty band set by maintainer
- Labels accepted: `Easy`/`Medium`/`Hard` (or `Stake-Easy` etc.) plus mandatory `Stake-50` for the exact coin amount
- Worker now registers on `issues.opened`, `reopened`, and `labeled` — not labeled-only
- Contributor must have sufficient coin balance before staking — show balance in UI
- Staked coins deducted immediately and locked until PR resolution

## Decisions
- Issues feed is partial — exact Stake-X CTA + difficulty filter live; open/staked/resolved status filter still missing
- Signup bonus is 150 PC; Hard Stake-X can be 80–200, so the live HARD #1 (160) needs a purchase or a smaller-stake issue
- Verified 2026-08-18: feed shows repo, exact 160 PC, cred 100, 1 staked; CTA becomes **Already Staked** after `POST /api/issues/:id/stake` with amount 160
