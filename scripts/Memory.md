# scripts — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-07-21

## Preferences
- KG scripts are standalone root-level scripts — not a workspace package, not in `packages/`
- Run via `pnpm kg:seed`, `pnpm kg:query`, `pnpm kg:reset` (tsx, no compile step)
- Neo4j connection: direct bolt `bolt://localhost:7687` — no ORM, no abstraction layer

## Patterns
- Feature statuses live in `FEATURES` array in `seed-knowledge-graph.ts` — edit there, re-run seed
- Seed is idempotent (MERGE-based) — safe to re-run after any status update
- `pnpm kg:query status` — phase completion overview before starting work
- `pnpm kg:query todo` — incomplete features with recommended skills
- `pnpm kg:query skills "<Feature>"` — which installed skills to use for a feature
- `pnpm kg:query deps "<Feature>"` — dependency chain and blockers

## Gotchas
- Neo4j container must be running: `docker compose up -d neo4j` before any kg:* command
- Container name: `pullquest-neo4j`, bolt port 7687, browser UI port 7474
- `neo4j-driver` dep lives in root `package.json` (not a workspace package dep)
- After completing a feature: update `status` in FEATURES array, run `pnpm kg:seed`

## Decisions
- Scripts at root (not `packages/`) — KG tooling is dev/AI tooling, not product code
- Direct bolt connection — no need for Neo4j ORM at this scale
