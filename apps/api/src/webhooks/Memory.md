# apps/api/src/webhooks — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-08-21

## Preferences
- Webhook handlers return 202 immediately; enqueue BullMQ job for issue/install events
- `pull_request` and `pull_request_review` are applied in-process via `PRService` so coin settlement and `pullquest_pr_outcomes_total` stay on the API
- Never do heavy Gemini work synchronously — GitHub times out at 10s

## Patterns
- `github.webhook.ts` — verify `x-hub-signature-256` with `GITHUB_WEBHOOK_SECRET` before any processing
- `stripe.webhook.ts` — verify with `stripe.webhooks.constructEvent` using raw body
- Dispatch to `WebhookService` which routes PR events to `PRService` and everything else onto `webhook-processing`

## Gotchas
- Raw body required for signature verification — register raw body parser before JSON parser for webhook routes
- GitHub sends duplicate events on retry; handlers must be idempotent (check if event already processed)
- Stripe `checkout.session.completed` credits via `purchaseCoins(session.id, bundleId)`; skip 409 already-bought-this-Act and already-credited session ids
- `installation` event creates org record + starts trial; `installation_repositories` syncs repo list

## Decisions
- Webhook processing: issue/install events go through BullMQ `webhook-processing`; PR lifecycle is handled in the API process
