# apps/web/ — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-07-21

## Preferences
- Server components by default; `'use client'` only where hooks/interactivity are needed
- Dark theme throughout: `bg-black`, zinc text scale, indigo/violet accent gradients
- Icons from `lucide-react`; styling via Tailwind v4 utility classes

## Patterns
- Data fetching via `lib/api.ts` `apiFetch()` — attaches Supabase access token as Bearer header
- Route protection centralized in `lib/supabase/middleware.ts`, wired through root `proxy.ts`
- Relative imports between app dirs (`../../lib/api`); `@/` alias exists but is mostly used inside `components/ui`

## Gotchas
- This project is on Next.js 16 — root file is `proxy.ts`, NOT `middleware.ts` (deprecated convention)
- Web port overridden in `docker-compose.yml`; local dev is :3000
- `NEXT_PUBLIC_API_URL` (browser) vs `INTERNAL_API_URL` (server-side callback route) point at the same Express API but differ in Docker networking
- Root layout metadata still says "Create Next App" — needs branding update

## Decisions
- Frontend is a thin client: no business logic, all economy/XP/leaderboard computation lives in the Express API
- Supabase used only for auth on the frontend; data reads go through the API, not direct Supabase queries
