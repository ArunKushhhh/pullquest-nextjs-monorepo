# apps/api/src/redis — Context

## Purpose
Redis utilities: generic cache helpers and leaderboard sorted-set operations.

## Key Files
- `cache.ts`
- `leaderboard.ts`

## Relationships
Used by leaderboard.service; sorted sets give O(log N) rank updates per PRD.

## PRD Reference
§2.6 Leaderboards, §6.5 Redis Usage
