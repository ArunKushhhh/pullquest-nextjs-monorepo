# infra/grafana — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-08-09

## Preferences
- Follow patterns in nearest parent Memory.md; workspace imports (@pullquest/*) before external before relative
- TypeScript strict; explicit error handling, never swallow

## Patterns
- 5 dashboards in `dashboards/`: pullquest-overview, api-overview, coin-economy, leaderboard-xp, worker-queues (the last 4 map to PRD §8.5)
- 4 alert rules provisioned via `provisioning/alerting/pullquest-alerts.yml`: treasury debt ceiling, API 5xx spike, worker job failures, act reset stuck
- Prometheus datasource has pinned `uid: prometheus`; all dashboard panels reference it by that uid

## Gotchas
- Changing a provisioned datasource's uid requires a `deleteDatasources` block in the datasource yml, or Grafana keeps the old one and errors
- Grafana runs on host network; its port comes from `GF_SERVER_HTTP_PORT=3002`, not a compose `ports:` mapping
- Alert rule JSON in provisioning ymls must use datasource uid (not name) in query `datasourceUid` fields

## Decisions
- Alerting is Grafana-managed (provisioned yml), not Prometheus Alertmanager — keeps a single provisioning surface
