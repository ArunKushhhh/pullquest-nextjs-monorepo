# apps/web/app/dashboard — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-08-21

## Preferences
- Server component by default; `'use client'` only for interactive widgets (stake button, realtime updates)
- Fetch data server-side via API routes (`NEXT_PUBLIC_API_URL`) not direct Supabase queries

## Patterns
- Dashboard shows: connected repos status, active stakes, current Act info, leaderboard position
- "Connect Repositories" button redirects to `https://github.com/apps/${NEXT_PUBLIC_GITHUB_APP_NAME}/installations/new`
- Realtime leaderboard updates via Supabase Realtime channel subscription (client component)

## Gotchas
- GitHub App installation status fetched from `GET /api/installations/status` — not from Supabase directly
- Act info from `GET /api/acts/current` — includes days remaining, act number
- User must have at least one merged PR in current Act to appear on leaderboard
- Install records only appear after GitHub delivers `installation` webhook to `POST /api/webhooks/github` — local needs a public tunnel, not `example.com`

## Decisions
- Dashboard is partial — Connect Repositories CTA wired; realtime + org sidebar pending
- GET /api/installations/status now embeds `repositories`; dashboard lists `full_name` under the GitHub account
- Overview shows PRs awaiting evaluation (`GET /api/prs/pending-evaluation`) with an Evaluate link to `/evaluate/{prId}`
- Overview shows current Act number and days remaining from `GET /api/acts/current`
- Worker must persist `payload.repositories` on `installation.created` — that event is not selectable in App settings (GitHub sends it by default)
