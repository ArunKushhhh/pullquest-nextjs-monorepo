# packages/database — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-08-13

## Preferences
- All schema changes go through Supabase migrations in `supabase/migrations/` — never alter tables directly
- Generated types in `src/types/database.types.ts` — regenerate with `pnpm db:types` after every migration
- Client factory in `src/client.ts` — server uses service role key, browser uses anon key
- Typed clients: `createClient<Database>` / `createSupabaseAdmin(): SupabaseClient<Database>`

## Patterns
- Migration naming: `NNN_description.sql` (e.g. `004_harden_users_update.sql`)
- RLS policies: users read/write own data; public profiles readable by all; treasury readable by org admins only
- Supabase Realtime channels: leaderboard position changes, stake notifications, PR status updates
- Authenticated UPDATE on `users` is column-granted only (`github_username`, `email`, `avatar_url`, `last_login_at`) — role/XP/coins stay service-role

## Gotchas
- `SUPABASE_SERVICE_ROLE_KEY` is server-only — never expose to frontend or commit to repo
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is intentionally public — safe to expose in browser bundle
- Run `pnpm db:types` after every migration or TypeScript will be out of sync with DB schema
- RLS must be enabled on every table — check with `get_advisors` via Supabase MCP after migrations
- `users_update_own` must have both USING and WITH CHECK; column grants block SET role/xp/coins via Data API
- Remote project id for typegen: `btvkhmofawwfgcwwtiot` (`pnpm db:types` uses `--project-id`)

## Decisions
- Four migrations: 001 initial schema, 002 RLS policies, 003 PR AI summary column, 004 harden users UPDATE + pin trigger search_path
- Supabase managed PostgreSQL — no self-hosted Postgres in Docker Compose
- GitHub App OAuth credentials (`Iv23…`) used as Supabase GitHub provider — one app for login + repo/webhooks, not a separate classic OAuth App
