# apps/api/src/webhooks — Context

## Purpose
Third-party event handlers: GitHub App webhooks (PR/issue events) and Stripe payment webhooks.

## Key Files
- `github.webhook.ts`
- `stripe.webhook.ts`

## Relationships
Signature verification mandatory before processing; heavy work offloaded to worker via queues.

## PRD Reference
§3.2 GitHub App, §7.4 PR Lifecycle, §7.6 Coin Economy
