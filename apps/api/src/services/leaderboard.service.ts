import { createSupabaseAdmin } from '@pullquest/database';
import {
  getLeaderboardPage,
  getLeaderboardSize,
  getUserRank,
  getUserScore,
} from '../redis/leaderboard.js';

const supabase = createSupabaseAdmin();

export async function getGlobalLeaderboard(
  actId: string,
  page = 1,
  limit = 10
) {
  const key = `leaderboard:global:${actId}`;

  // Fetch page from Redis
  const pageEntries = await getLeaderboardPage(key, page, limit);
  const total = await getLeaderboardSize(key);

  if (pageEntries.length === 0) {
    return { data: [], total };
  }

  // Enrich with user profile data from Supabase
  const userIds = pageEntries.map((e) => e.userId);
  const { data: users, error } = await supabase
    .from('users')
    .select('id, github_username, avatar_url, current_tier')
    .in('id', userIds);

  if (error) throw error;

  const startRank = (page - 1) * limit + 1;
  const enriched = pageEntries.map((entry, index) => {
    const user = users?.find((u) => u.id === entry.userId);
    return {
      rank: startRank + index,
      userId: entry.userId,
      github_username: user?.github_username || 'unknown',
      avatar_url: user?.avatar_url || null,
      xp: entry.score,
      tier: user?.current_tier || 'UNRANKED',
    };
  });

  return {
    data: enriched,
    total,
  };
}

export async function getOrgLeaderboard(
  orgId: string,
  actId: string,
  page = 1,
  limit = 10
) {
  const key = `leaderboard:org:${orgId}:${actId}`;

  const pageEntries = await getLeaderboardPage(key, page, limit);
  const total = await getLeaderboardSize(key);

  if (pageEntries.length === 0) {
    return { data: [], total };
  }

  const userIds = pageEntries.map((e) => e.userId);
  const { data: users, error } = await supabase
    .from('users')
    .select('id, github_username, avatar_url, current_tier')
    .in('id', userIds);

  if (error) throw error;

  const startRank = (page - 1) * limit + 1;
  const enriched = pageEntries.map((entry, index) => {
    const user = users?.find((u) => u.id === entry.userId);
    return {
      rank: startRank + index,
      userId: entry.userId,
      github_username: user?.github_username || 'unknown',
      avatar_url: user?.avatar_url || null,
      xp: entry.score,
      tier: user?.current_tier || 'UNRANKED',
    };
  });

  return {
    data: enriched,
    total,
  };
}

export async function getUserGlobalRank(userId: string, actId: string) {
  const key = `leaderboard:global:${actId}`;
  const rank = await getUserRank(key, userId);
  const score = await getUserScore(key, userId);

  return {
    rank,
    score: score !== null ? score : 0,
  };
}
