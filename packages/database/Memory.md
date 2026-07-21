# packages/database — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-07-21

## Preferences
- All schema changes go through Supabase migrations in `supabase/migrations/` — never alter tables directly
- Generated types in `src/types.ts` — regenerate with `pnpm db:types` after every migration
- Client factory in `src/client.ts` — server uses service role key, browser uses anon key

## Patterns
- Migration naming: `NNN_description.sql` (e.g. `004_add_evaluations_index.sql`)
- RLS policies: users read/write own data; public profiles readable by all; treasury readable by org admins only
- Supabase Realtime channels: leaderboard position changes, stake notifications, PR status updates

## Gotchas
- `SUPABASE_SERVICE_ROLE_KEY` is server-only — never expose to frontend or commit to repo
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is intentionally public — safe to expose in browser bundle
- Run `pnpm db:types` after every migration or TypeScript will be out of sync with DB schema
- RLS must be enabled on every table — check with `get_advisors` via Supabase MCP after migrations

## Decisions
- Three migrations so far: 001 initial schema, 002 RLS policies, 003 PR AI summary column
- Supabase managed PostgreSQL — no self-hosted Postgres in Docker Compose
