# apps/web/app/leaderboard — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-08-20

## Preferences
- Use `dataviz` skill before building any chart or ranking visualization
- Fetch from `GET /api/leaderboard/global` and `GET /api/leaderboard/org/:orgId`

## Patterns
- Global leaderboard: paginated, Redis-backed sorted set, O(log N) rank queries
- Org leaderboard: same pattern scoped to org XP
- Users only appear after first merged PR in current Act (Unranked otherwise)
- Realtime updates via Supabase Realtime channel subscription

## Gotchas
- Leaderboard shows Act-scoped XP, not all-time XP
- Tier displayed is current Act tier — user starts Unranked each Act
- Pagination: `?page=&limit=` defaults to limit 20

## Decisions
- Leaderboard page is partial — static layout exists, realtime + pagination incomplete
- Live 2026-08-20: first Act 1 score (ArunKushhhh, 40 XP) appears at #1 after evaluation; Redis keys `leaderboard:global:{actId}` and `leaderboard:org:{orgId}:{actId}`
