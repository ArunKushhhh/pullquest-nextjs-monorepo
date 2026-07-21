# apps/worker/src/jobs — Context

## Purpose
Job processors: actReset (45-day cycle), aiSummary (Gemini), coinMinting (monthly 100), treasuryAudit, webhook (GitHub events), xp (scoring).

## Key Files
- `actReset.processor.ts`
- `aiSummary.processor.ts`
- `coinMinting.processor.ts`
- `treasuryAudit.processor.ts`
- `webhook.processor.ts`
- `xp.processor.ts`

## Relationships
Each processor calls service logic; failures retried per BullMQ policy; emits Prometheus metrics.

## PRD Reference
§7.5 Act Reset, §2.10 AI Layer, §2.7 Coin Economy, §2.4 XP
