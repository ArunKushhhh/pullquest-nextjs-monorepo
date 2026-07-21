# packages/shared/src — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-07-21

## Preferences
- Zero runtime dependencies — no Supabase, Redis, Express, or BullMQ imports ever
- Pure functions and types only; no side effects, no I/O

## Patterns
- XP formula: `Cap × (evaluationScore / 5) × trustMultiplier` — lives in `utils/`
- Trust multiplier: highest applicable bracket (not additive) — 0.5×/0.8×/1×/1.5×
- Tier thresholds: Initiator 0–100, Commiter 100–500, Contributor 500–1500, Merge Master 1500–3000, Architect 3000–5000, Open Source Legend 5000+
- Coin base amounts per tier used for Act reset earned_coins restoration
- All enums in `enums/`; all TypeScript interfaces in `types/`; all pure logic in `utils/`

## Gotchas
- `@pullquest/shared` is consumed by api, worker, AND web — never add server-only deps
- Tier name "Commiter" (one t) — matches PRD spelling exactly; do not correct to "Committer"
- XP is never negative — clamp to 0 minimum in formula util

## Decisions
- Barrel export from `src/index.ts` — all consumers import from `@pullquest/shared` not deep paths
