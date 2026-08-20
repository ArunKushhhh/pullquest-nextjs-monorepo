# apps/web/app/evaluate — Context

## Purpose
Maintainer evaluation questionnaire for merged PRs. Submitting scores awards XP via `POST /api/prs/:id/evaluate`.

## Key Files
- `[prId]/page.tsx`

## Relationships
Dashboard lists pending evaluations; this page submits scores. XP formula lives in `@pullquest/shared`.

## PRD Reference
§2.4 XP Scoring Engine, §4.2 Maintainer Workflow
