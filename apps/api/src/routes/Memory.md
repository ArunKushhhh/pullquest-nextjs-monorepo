# apps/api/src/routes — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-08-21

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
- `GET /api/prs/pending-evaluation` must be registered before `GET /api/prs/:id` or Express treats `pending-evaluation` as an id
- `POST /api/prs/:id/evaluate` returns `{ evaluation, xpLog }`; `EvaluationError` maps to 400/403/404/409
- `POST /api/acts/reset` is development / platform-admin only and returns 202 `{ queued, jobId }`
- `GET /api/coins/bundles` requires auth; `POST /api/coins/create-checkout-session` maps `CoinError` 409 for a pack already bought this Act

## Decisions
- No controllers directory currently — routes call services directly; add controllers if handlers exceed ~30 lines
