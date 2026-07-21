# scripts — Context

## Purpose
Neo4j Knowledge Graph tooling: seed-knowledge-graph.ts (PRD→graph, idempotent MERGE), query-knowledge-graph.ts (status/todo/skills/deps), reset-knowledge-graph.ts (wipe).

## Key Files
- `query-knowledge-graph.ts`
- `reset-knowledge-graph.ts`
- `seed-knowledge-graph.ts`

## Relationships
Run via pnpm kg:seed / kg:query / kg:reset; Neo4j bolt://localhost:7687 (container pullquest-neo4j); feature statuses live in FEATURES array of seed script — edit there, re-seed.

## PRD Reference
Whole PRD — graph mirrors §2 features, phases, skills
