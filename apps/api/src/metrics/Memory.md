# apps/api/src/metrics — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-07-21

## Preferences
- All Prometheus metric definitions in `definitions.ts` — import before middleware registration
- Use `prom-client` default registry — no custom registries

## Patterns
- Counters: `pullquest_api_requests_total`, `pullquest_stakes_total`, `pullquest_pr_outcomes_total`, `pullquest_xp_awarded_total`, `pullquest_coins_minted_total`
- Histograms: `pullquest_api_request_duration_seconds`, `pullquest_leaderboard_update_duration_seconds`
- Gauges: `pullquest_treasury_balance`, `pullquest_active_users`, `pullquest_job_queue_depth`
- Exposed at `GET /api/metrics` — scraped by Prometheus container at `:9090`

## Gotchas
- `definitions.ts` must be imported before metrics middleware — counters must exist before increment
- `pullquest_pr_outcomes_total` uses label `type` with values: merged/rejected/closed/unreviewed/multiple
- Treasury balance gauge updated after every treasury transaction (not on scrape)

## Decisions
- Prometheus scrape interval configured in `infra/prometheus/prometheus.yml`
