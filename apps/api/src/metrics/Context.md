# apps/api/src/metrics — Context

## Purpose
Prometheus metric definitions (counters, histograms) for API instrumentation.

## Key Files
- `definitions.ts`

## Relationships
Imported before metrics middleware registers; scraped by infra/prometheus via /metrics route.

## PRD Reference
§8.4 Prometheus
