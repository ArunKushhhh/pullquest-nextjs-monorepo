# apps/worker — Context

## Purpose
BullMQ job processor app (@pullquest/worker). No HTTP server — consumes Redis queues.

## Key Files
- `dist/`
- `Dockerfile`
- `node_modules/`
- `package.json`
- `src/`
- `tsconfig.json`

## Relationships
Consumes jobs produced by API; queue names must match apps/api/src/config/queues.ts; containerized via Dockerfile.

## PRD Reference
§6.6 Worker Architecture
