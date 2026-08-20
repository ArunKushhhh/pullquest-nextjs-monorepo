# apps/api/src/webhooks — Context

## Purpose
Third-party event handlers: GitHub App webhooks (PR/issue events) and Stripe payment webhooks.

## Key Files
- `github.webhook.ts`
- `stripe.webhook.ts`

## Relationships
Signature verification mandatory before processing; issue/install events go to the worker queue; PR open/review/close is applied by PRService in the API process.

## PRD Reference
§3.2 GitHub App, §7.4 PR Lifecycle, §7.6 Coin Economy
