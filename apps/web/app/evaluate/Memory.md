# apps/web/app/evaluate — Memory

> Last updated: 2026-08-20

## Preferences
- Client page: sliders need live XP preview
- Fetch `GET /api/prs/:id` then `POST /api/prs/:id/evaluate` through `apiFetch`

## Patterns
- Five scores 0–5 step 0.5; total is the mean used as Evaluation Score
- Preview: `floor(xpCap × (avg / 5) × trustMultiplier)` from API `xpPreview`

## Gotchas
- Only the GitHub App installer for the repo can evaluate
- PR must be `AWAITING_EVALUATION` with outcome MERGED or MULTIPLE_ACCEPTED
- XP is 0 until this form is submitted — merge alone does not award XP
- Live 2026-08-20: PR #2 HARD at default 4.0 sliders awarded 40 XP (cap 100 × 0.8 × 0.5 trust). Dashboard pending card cleared; profile shows scores + `+40 XP`
