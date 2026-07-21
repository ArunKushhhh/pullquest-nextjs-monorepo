# infra/redis — Context

## Purpose
redis.conf for the Redis container (persistence, memory policy).

## Key Files
- `redis.conf`

## Relationships
Mounted by docker-compose; serves BullMQ queues + leaderboard sorted sets + cache.

## PRD Reference
§8.2 Redis
