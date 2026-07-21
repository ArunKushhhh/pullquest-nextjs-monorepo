# apps/web/app/issues — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-07-21

## Preferences
- Server component for list fetch; client component only for stake action button
- Fetch from `GET /api/issues?org=&difficulty=&status=` — not direct Supabase

## Patterns
- Each issue card shows: stake amount, difficulty band, org credibility score, trust multiplier
- Stake action: `POST /api/issues/:id/stake { amount }` — requires auth
- Filter by difficulty (Easy/Medium/Hard) and status (open/staked/resolved)

## Gotchas
- Issue only appears if it has valid `Stake-X` label AND difficulty band set by maintainer
- Contributor must have sufficient coin balance before staking — show balance in UI
- Staked coins deducted immediately and locked until PR resolution

## Decisions
- Issues feed is partial — layout exists, stake flow and filtering incomplete
