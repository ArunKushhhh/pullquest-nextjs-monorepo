# apps/api/src/routes — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-07-21

## Preferences
- Route files are thin HTTP adapters only — no business logic
- One route file per domain entity; mount all in `src/index.ts`
- Auth middleware applied per-router, not per-route (except public endpoints)

## Patterns
- Route → controller (optional thin layer) → service
- Webhook routes skip auth middleware; verify GitHub/Stripe signatures in service instead
- Paginated endpoints accept `?page=&limit=` query params; default limit 20
- All routes return `{ data, error }` shaped JSON

## Gotchas
- `/api/webhooks/github` and `/api/webhooks/stripe` must use raw body parser (not JSON) for signature verification
- `/api/orgs/:orgId/treasury` restricted to org admins — check role in route middleware
- Metrics route (`/api/metrics`) must be excluded from auth middleware

## Decisions
- No controllers directory currently — routes call services directly; add controllers if handlers exceed ~30 lines
