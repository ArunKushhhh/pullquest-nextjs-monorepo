# apps/api/src/services — Context

## Purpose
15 service files holding all business logic: staking, PR resolution, XP, coins, treasury, credibility, evaluation, auth, installations, orgs, users, webhooks.

## Key Files
- `act.service.ts`
- `auth.service.ts`
- `coin.service.ts`
- `credibility.service.ts`
- `evaluation.service.ts`
- `installation.service.ts`
- `issue.service.ts`
- `leaderboard.service.ts`
- `org.service.ts`
- `pr.service.ts`
- `stake.service.ts`
- `treasury.service.ts`
- `user.service.ts`
- `webhook.service.ts`
- `xp.service.ts`

## Relationships
Called by routes + webhooks; use @pullquest/database Supabase admin client; enqueue BullMQ jobs via config/queues.

## PRD Reference
§6.4 Service Layer, §2.2–2.9 feature logic
