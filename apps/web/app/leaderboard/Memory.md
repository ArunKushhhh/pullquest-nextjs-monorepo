# apps/web/app/leaderboard — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-08-21

## Preferences
- Use `dataviz` skill before building any chart or ranking visualization
- Fetch from `GET /api/leaderboard/global` and `GET /api/leaderboard/org/:orgId`
- Org tabs come from `GET /api/installations/status` (`organization.id`)

## Patterns
- Global leaderboard: paginated, Redis-backed sorted set, O(log N) rank queries
- Org leaderboard: same pattern scoped to org XP
- Users only appear after first merged PR in current Act (Unranked otherwise)
- Response includes `me` when the request is authenticated: `{ rank, xp, tier, visible }`

## Gotchas
- Leaderboard shows Act-scoped XP, not all-time XP
- Tier displayed is current Act tier — user starts Unranked each Act
- Pagination: `?page=&limit=` defaults to limit 10
- Redis keys are `leaderboard:global:{actId}` (no `act:` infix); empty sets hydrate from Postgres because Docker Redis uses `allkeys-lru`
- Realtime updates are a separate PRD feature (`Realtime Updates`)

## Decisions
- Live 2026-08-21: Act 1 global + PullQuestTest org; ArunKushhhh #1 INITIATOR 40 XP; ghost Redis members are dropped
