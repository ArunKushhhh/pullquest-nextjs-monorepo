# apps/web/app/dashboard — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-07-21

## Preferences
- Server component by default; `'use client'` only for interactive widgets (stake button, realtime updates)
- Fetch data server-side via API routes (`NEXT_PUBLIC_API_URL`) not direct Supabase queries

## Patterns
- Dashboard shows: connected repos status, active stakes, current Act info, leaderboard position
- "Connect Repositories" button redirects to `github.com/apps/pullquest/installations/new`
- Realtime leaderboard updates via Supabase Realtime channel subscription (client component)

## Gotchas
- GitHub App installation status fetched from `GET /api/installations/status` — not from Supabase directly
- Act info from `GET /api/acts/current` — includes days remaining, act number
- User must have at least one merged PR in current Act to appear on leaderboard

## Decisions
- Dashboard is partial — core layout exists, realtime + org sidebar pending
