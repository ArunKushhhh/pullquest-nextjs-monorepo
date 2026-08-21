# packages/shared/src — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-08-21

## Preferences
- Zero runtime dependencies — no Supabase, Redis, Express, or BullMQ imports ever
- Pure functions and types only; no side effects, no I/O

## Patterns
- XP formula: `Cap × (evaluationScore / 5) × trustMultiplier` — lives in `utils/`
- Trust multiplier: highest applicable bracket (not additive) — 0.5×/0.8×/1×/1.5×
- Tier thresholds: Initiator 0–100, Commiter 100–500, Contributor 500–1500, Merge Master 1500–3000, Architect 3000–5000, Open Source Legend 5000+
- Coin base amounts per tier used for Act reset earned_coins restoration
- All enums in `enums/`; all TypeScript interfaces in `types/`; all pure logic in `utils/`
- Stake gating: `parseStakeLabels` + `evaluateStakeAttempt` — API/worker/tests must not re-implement label or exact-amount rules
- PR lifecycle: `parseIssueNumbers` + `classifyPROutcome` + `computePRFinancials` — five outcomes, no I/O

## Gotchas
- `@pullquest/shared` is consumed by api, worker, AND web — never add server-only deps
- Tier name "Commiter" (one t) — matches PRD spelling exactly; do not correct to "Committer"
- XP is never negative — clamp to 0 minimum in formula util
- Unreviewed (no review) is not Closed-without-merge (reviewed, not `changes_requested`) — compensation only on the latter
- `getTrustMultiplier`: member brackets match members only. Star brackets must require `minStars > 0` — a `minStars: 0` row previously matched every repo via `|| starsMatch` and pinned trust at 0.8×. Default with 0 stars / 0 members is 0.5×
- UNRANKED users still compress from `getTierForXP` (`effectiveTierForActReset`)
- `actDaysRemaining` is whole days until `end_date`, floored at 0

## Decisions
- Barrel export from `src/index.ts` — all consumers import from `@pullquest/shared` not deep paths
