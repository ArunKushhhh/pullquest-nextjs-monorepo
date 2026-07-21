# apps/web/ — Context

## Purpose
Next.js (App Router) frontend for PullQuest (`@pullquest/web`, port 3000). Handles GitHub OAuth login via Supabase, and renders the dashboard, staking issues feed, leaderboard, and public user profiles. Talks to the Express API (`apps/api`, port 3001) for all business data.

## Key Files
- `app/` — App Router pages, layouts, and the auth callback route handler
- `components/` — Shared React components (`Navbar.tsx`) and shadcn/ui primitives (`ui/`)
- `lib/` — `api.ts` (authenticated fetch wrapper), `utils.ts` (`cn` helper), `supabase/` (browser/server/middleware clients)
- `proxy.ts` — Next.js 16 proxy convention (replaces `middleware.ts`); delegates to `lib/supabase/middleware.ts` for session refresh + route protection
- `public/` — Static SVG assets (default create-next-app icons) + favicon
- `next.config.ts`, `postcss.config.mjs`, `components.json` — Next.js, Tailwind v4, and shadcn config
- `Dockerfile` — Container build for the web app
- `package.json`, `tsconfig.json`, `eslint.config.mjs` — Workspace package config

## Dependencies
- `@supabase/ssr` + `@supabase/supabase-js` — auth (cookie-based sessions)
- `next` 16, `react` 19, `tailwindcss` v4, `shadcn`, `radix-ui`, `class-variance-authority`, `lucide-react`, `clsx`, `tailwind-merge`

## Relationships
- All data fetching goes through `lib/api.ts` → Express API at `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`)
- `proxy.ts` → `lib/supabase/middleware.ts` guards `/dashboard`, `/issues`, `/leaderboard`
- `app/auth/callback/route.ts` exchanges the OAuth code and notifies the Express API via `INTERNAL_API_URL`

## PRD Reference
- Frontend surface of the platform: login (GitHub OAuth), dashboard (coins/stakes/purchases), issues staking feed, seasonal leaderboard, public profiles
