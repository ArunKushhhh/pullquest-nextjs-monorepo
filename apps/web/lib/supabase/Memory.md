# apps/web/lib/supabase — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-07-21

## Preferences
- Use `@supabase/ssr` for all Next.js Supabase clients — never `@supabase/supabase-js` directly in web
- Server components use `server.ts`; middleware uses `middleware.ts`; client components use `client.ts`

## Patterns
- `server.ts` — creates server-side Supabase client with cookie handling for SSR
- `client.ts` — creates browser-side Supabase client (singleton pattern)
- `middleware.ts` — refreshes session cookies on every request via `updateSession()`
- All three use `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — no service role key in web

## Gotchas
- Never use service role key in `apps/web` — anon key + RLS is the correct pattern for frontend
- `getUser()` is safe for auth checks; `getSession()` is deprecated for security-sensitive checks
- Middleware must be registered in `proxy.ts` (Next.js 16 convention) not `middleware.ts`

## Decisions
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are the only env vars allowed in web Supabase clients
