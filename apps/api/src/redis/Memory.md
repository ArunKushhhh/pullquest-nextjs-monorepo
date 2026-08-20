# apps/api/src/redis — Memory

> This file is continuously updated as the team learns about the product.
> Last updated: 2026-08-20

## Preferences
- Split by concern: `cache.ts` for generic TTL cache, `leaderboard.ts` for sorted set operations
- Use ioredis client from `config/redis.ts` — never create new connections in utility files

## Patterns
- Leaderboard keys: `leaderboard:global:{actId}` and `leaderboard:org:{orgId}:{actId}` (no `act:` infix)
- Org board: `incrementLeaderboardScore` (`ZINCRBY` awarded XP). Global: `updateLeaderboardScore` (`ZADD` all-time XP)
- Cache keys: `cache:user:{userId}` (5m), `cache:credibility:{orgId}` (15m), `cache:issue:{issueId}` (2m)
- Session keys: `session:{userId}` (30m) — stores active stakes + current tier beyond JWT
- Rate limit keys: `ratelimit:{ip}:{window}` — sliding window, 100 req/min default

## Gotchas
- Leaderboard sorted sets are persistent (no TTL) — cleared only on Act reset
- `ZADD` with `XX` flag updates only existing members; use without flag for new entries
- Session cache supplements Supabase JWT — do not store sensitive data (no tokens, no keys)
- `cache:issue:{id}` is a Redis hash (`stake_amount`, `difficulty`, `is_open`, `participants`), not a JSON string — use `cacheHashSet`
- Cache writes fail open (log + continue) so staking still works if Redis is down

## Decisions
- BullMQ uses its own Redis connection from `config/queues.ts` — separate from cache/leaderboard client
