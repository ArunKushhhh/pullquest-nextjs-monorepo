import { redis } from '../config/redis.js';

export const ISSUE_CACHE_TTL_SECONDS = 120;
export const SESSION_TTL_SECONDS = 1800;

export function issueCacheKey(issueId: string): string {
  return `cache:issue:${issueId}`;
}

export function sessionCacheKey(userId: string): string {
  return `session:${userId}`;
}

export async function cacheHashSet(
  key: string,
  fields: Record<string, string>,
  ttlSeconds: number
): Promise<void> {
  try {
    if (Object.keys(fields).length === 0) return;
    await redis.hset(key, fields);
    await redis.expire(key, ttlSeconds);
  } catch (err) {
    console.error(`[Cache]: Hash set error for key ${key}:`, err);
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (err) {
    console.error(`[Cache]: Get error for key ${key}:`, err);
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  try {
    const stringValue = JSON.stringify(value);
    await redis.set(key, stringValue, 'EX', ttlSeconds);
  } catch (err) {
    console.error(`[Cache]: Set error for key ${key}:`, err);
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (err) {
    console.error(`[Cache]: Delete error for key ${key}:`, err);
  }
}
