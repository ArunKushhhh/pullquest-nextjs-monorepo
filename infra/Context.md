# infra — Context

## Purpose
Infrastructure configs for docker-compose services: Prometheus, Grafana, Redis.

## Key Files
- `grafana/`
- `prometheus/`
- `redis/`

## Relationships
Mounted as volumes by docker-compose.yml; Neo4j needs no config dir (env-configured).

## PRD Reference
§8 Infrastructure
