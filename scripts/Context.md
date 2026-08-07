# scripts — Context

## Purpose
Neo4j Knowledge Graph tooling seeded from the full PRD. Agent/project rules live in `.cursor/rules/pullquest.mdc` (Cursor); Claude Code `.claude/` removed.

## Key Files
- `kg-config.ts` — NEO4J_URI/USER/PASSWORD from .env
- `seed-knowledge-graph.ts` — PRD features, services, routes, economy rules, workflows
- `query-knowledge-graph.ts` — CLI queries for agents
- `reset-knowledge-graph.ts` — DETACH DELETE all nodes

## Graph Model
`(Project)-[:HAS_PHASE]->(Phase)-[:CONTAINS]->(Feature)` plus edges for components, services, routes, Redis, roles, PR outcomes, webhooks, PRD sections, workflows, economy rules.

## Relationships
Run via `pnpm kg:seed` / `kg:query` / `kg:reset`; Neo4j bolt://localhost:7687 (container pullquest-neo4j); feature statuses live in FEATURES array — edit there, re-seed.

## PRD Reference
Entire PRD — §1 roles, §2 features, §3 GitHub integration, §4 workflows, §6 backend, §8 infra, §10 scope (post-launch items stored as PostLaunchItem, excluded from build)
