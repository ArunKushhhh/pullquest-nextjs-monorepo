# apps/worker/src — Context

## Purpose
Worker source: entrypoint wiring queues to processors, config, jobs.

## Key Files
- `config/`
- `index.ts`
- `jobs/`
- `queues/`

## Relationships
index.ts registers processors per queue; config/ mirrors API env+redis setup.

## PRD Reference
§6.6
