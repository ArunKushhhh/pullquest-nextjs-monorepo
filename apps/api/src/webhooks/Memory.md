# apps/api/src/webhooks — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-07-21

## Preferences
- Webhook handlers return 200 immediately; enqueue BullMQ job for actual processing
- Never do heavy work synchronously — GitHub times out at 10s

## Patterns
- `github.webhook.ts` — verify `x-hub-signature-256` with `GITHUB_WEBHOOK_SECRET` before any processing
- `stripe.webhook.ts` — verify with `stripe.webhooks.constructEvent` using raw body
- Dispatch to `WebhookService` which routes to domain services

## Gotchas
- Raw body required for signature verification — register raw body parser before JSON parser for webhook routes
- GitHub sends duplicate events on retry; handlers must be idempotent (check if event already processed)
- `installation` event creates org record + starts trial; `installation_repositories` syncs repo list

## Decisions
- Webhook processing decoupled via BullMQ `webhook-processing` queue — API enqueues, worker processes
