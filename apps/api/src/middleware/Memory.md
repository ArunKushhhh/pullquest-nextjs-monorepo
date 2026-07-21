# apps/api/src/middleware — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-07-21

## Preferences
- Middleware registered in order in `src/index.ts` — order matters
- Auth middleware attaches `req.user` — downstream handlers assume it exists on protected routes

## Patterns
- Middleware stack order: Sentry → CORS → rate limiter → JSON body → Prometheus → auth → routes → Sentry error → global error
- `auth.ts` — validates Supabase JWT, resolves to PullQuest user, attaches to `req.user`
- `errorHandler.ts` — formats errors, logs to Sentry, returns `{ error: { message, code } }`
- `metrics.ts` — increments `pullquest_api_requests_total` counter + records request duration histogram
- `rateLimiter.ts` — Redis sliding window, 100 req/min per IP

## Gotchas
- Webhook routes (`/api/webhooks/*`) must bypass auth middleware and JSON body parser — use raw body
- Error handler must be registered LAST — after all routes
- Prometheus middleware must run before auth so unauthenticated requests are still counted
- Rate limiter uses Redis — if Redis is down, fail open (don't block requests)

## Decisions
- Global error handler catches all unhandled errors; services throw typed errors with `code` field
