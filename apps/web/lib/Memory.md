# apps/web/lib — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-07-21

## Preferences
- `lib/` contains only utility functions and client factories — no React components
- All API calls go through `lib/api.ts` helper — never raw `fetch` in page/component files

## Patterns
- `api.ts` — base URL from `NEXT_PUBLIC_API_URL`, attaches Supabase JWT to `Authorization` header
- `supabase/` — three clients: `client.ts` (browser), `server.ts` (SSR), `middleware.ts` (session refresh)

## Gotchas
- `NEXT_PUBLIC_API_URL` defaults to `http://localhost:3001` for local dev
- Server-side API calls use `server.ts` Supabase client to get session token for auth header
- Never import server-only Supabase client in client components — use `client.ts` instead

## Decisions
- API abstraction in `lib/api.ts` keeps auth header logic in one place
