# infra — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-08-09

## Preferences
- All infra config is file-based — no manual dashboard edits that aren't committed
- Docker Compose is the single source of truth for service topology

## Patterns
- Services: redis :6379, prometheus :9090, grafana :3002, neo4j :7687/:7474, api :3001, worker (no port), web :3000
- Grafana admin: `admin` / `admin` (change in production)
- Prometheus scrapes `localhost:3001/api/metrics` for API metrics (host networking)
- Neo4j bolt: `bolt://localhost:7687`, auth: `neo4j/pullquest123` (dev only)

## Gotchas
- Web container gets NO `env_file` — only explicit `NEXT_PUBLIC_*` vars passed; server secrets never reach web
- PostgreSQL is Supabase-managed — not in Docker Compose
- Neo4j data persisted in `neo4j-data` Docker volume — `pnpm kg:reset` wipes graph but not volume
- Host firewall on this machine DROPS bridge→host traffic: `host.docker.internal` is unreachable from containers (even for docker-published ports via the gateway IP). That is why prometheus + grafana run with `network_mode: host`
- `docker compose up -d` does NOT apply compose-file changes to running containers — use `--force-recreate` after editing service config

## Decisions
- Prometheus + Grafana use `network_mode: host` so Prometheus reaches the API at `localhost:3001` in BOTH modes (host `pnpm dev:api` and dockerized api, which publishes 3001). Grafana port set via `GF_SERVER_HTTP_PORT=3002`; datasource URL is `http://localhost:9090`
- Grafana dashboards provisioned from `infra/grafana/provisioning/` — auto-loaded on container start
- Redis config from `infra/redis/redis.conf` — mounted into container
