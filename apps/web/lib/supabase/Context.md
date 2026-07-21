# apps/web/lib/supabase — Context

## Purpose
Supabase client factories: browser client (client components) and server client (@supabase/ssr, cookie-based) for server components/route handlers.

## Key Files
- `client.ts`
- `middleware.ts`
- `server.ts`

## Relationships
Session cookies flow through middleware/proxy; server client used in auth callback.

## PRD Reference
§7.1 Authentication Flow
