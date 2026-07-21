# apps/web/app/login — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-07-21

## Preferences
- Login is GitHub OAuth only — no email/password, no other providers
- Use `supabase.auth.signInWithOAuth({ provider: 'github' })` from client component

## Patterns
- Single "Sign in with GitHub" button — no other UI needed
- On success: Supabase redirects to `/auth/callback` which calls `POST /api/auth/callback`
- New users get 150 coins credited on first login (handled server-side in API)

## Gotchas
- Login page is done — do not add complexity; keep it minimal
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` required in web env

## Decisions
- Login page complete; auth callback handled in `apps/web/app/auth/callback/`
