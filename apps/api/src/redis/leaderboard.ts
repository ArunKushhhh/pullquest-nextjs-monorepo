import { redis } from '../config/redis.js';

/**
 * Update the user's score in the sorted set.
 */
export async function updateLeaderboardScore(
  key: string,
  userId: string,
  score: number
): Promise<void> {
  await redis.zadd(key, score, userId);
}

/** Add `delta` to an org leaderboard so it tracks XP earned in that org, not global XP. */
export async function incrementLeaderboardScore(
  key: string,
  userId: string,
  delta: number
): Promise<void> {
  await redis.zincrby(key, delta, userId);
}

/**
 * Retrieve a paginated page of user IDs and their scores.
 * Returns an array of objects: { userId: string, score: number }
 */
export async function getLeaderboardPage(
  key: string,
  page: number,
  limit: number
): Promise<{ userId: string; score: number }[]> {
  const start = (page - 1) * limit;
  const stop = start + limit - 1;

  // Retrieve elements descending (highest score first)
  const results = await redis.zrevrange(key, start, stop, 'WITHSCORES');
  
  const entries: { userId: string; score: number }[] = [];
  for (let i = 0; i < results.length; i += 2) {
    entries.push({
      userId: results[i],
      score: Math.floor(parseFloat(results[i + 1])),
    });
  }
  return entries;
}

/**
 * Get user's rank (1-indexed). Returns null if user is not in the set.
 */
export async function getUserRank(
  key: string,
  userId: string
): Promise<number | null> {
  const rank = await redis.zrevrank(key, userId);
  return rank !== null ? rank + 1 : null;
}

/**
 * Get user's score from the leaderboard.
 */
export async function getUserScore(
  key: string,
  userId: string
): Promise<number | null> {
  const score = await redis.zscore(key, userId);
  return score !== null ? Math.floor(parseFloat(score)) : null;
}

/**
 * Get total number of contributors on the leaderboard.
 */
export async function getLeaderboardSize(key: string): Promise<number> {
  return await redis.zcard(key);
}
