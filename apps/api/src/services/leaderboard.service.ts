import { createSupabaseAdmin } from '@pullquest/database';
import { isVisibleOnLeaderboard } from '@pullquest/shared';
import { config } from '../config/env.js';
import { cacheGet, cacheSet } from '../redis/cache.js';
import {
  getLeaderboardRange,
  getUserRank,
  getUserScore,
  globalLeaderboardKey,
  orgLeaderboardKey,
  removeLeaderboardMembers,
  updateLeaderboardScore,
  visibleLeaderboardCacheKey,
} from '../redis/leaderboard.js';

const supabase = createSupabaseAdmin();

export type LeaderboardRow = {
  rank: number;
  userId: string;
  github_username: string;
  avatar_url: string | null;
  xp: number;
  tier: string;
};

export type ViewerStanding = {
  rank: number | null;
  xp: number;
  tier: string;
  visible: boolean;
};

type CachedVisibleRow = Omit<LeaderboardRow, 'rank'>;

type UserVisibilityRow = {
  id: string;
  github_username: string | null;
  avatar_url: string | null;
  current_tier: string | null;
  has_merged_pr_this_act: boolean | null;
  current_act_id: string | null;
};

async function hydrateGlobalFromDb(
  actId: string
): Promise<{ userId: string; score: number }[]> {
  const { data, error } = await supabase
    .from('users')
    .select(
      'id, global_xp, current_tier, has_merged_pr_this_act, current_act_id'
    )
    .eq('has_merged_pr_this_act', true)
    .neq('current_tier', 'UNRANKED');

  if (error) throw error;

  const key = globalLeaderboardKey(actId);
  const entries: { userId: string; score: number }[] = [];
  for (const row of data ?? []) {
    if (
      !isVisibleOnLeaderboard(
        {
          has_merged_pr_this_act: Boolean(row.has_merged_pr_this_act),
          current_tier: row.current_tier || 'UNRANKED',
          current_act_id: row.current_act_id,
        },
        actId
      )
    ) {
      continue;
    }
    const score = Number(row.global_xp) || 0;
    await updateLeaderboardScore(key, row.id, score);
    entries.push({ userId: row.id, score });
  }
  return entries.sort((a, b) => b.score - a.score);
}

async function hydrateOrgFromDb(
  orgId: string,
  actId: string
): Promise<{ userId: string; score: number }[]> {
  const { data: logs, error } = await supabase
    .from('xp_logs')
    .select('user_id, xp_awarded')
    .eq('org_id', orgId)
    .eq('act_id', actId);

  if (error) throw error;

  const sums = new Map<string, number>();
  for (const log of logs ?? []) {
    sums.set(log.user_id, (sums.get(log.user_id) ?? 0) + Number(log.xp_awarded || 0));
  }
  if (sums.size === 0) return [];

  const { data: users, error: userErr } = await supabase
    .from('users')
    .select('id, current_tier, has_merged_pr_this_act, current_act_id')
    .in('id', [...sums.keys()]);

  if (userErr) throw userErr;

  const key = orgLeaderboardKey(orgId, actId);
  const entries: { userId: string; score: number }[] = [];
  for (const user of users ?? []) {
    if (
      !isVisibleOnLeaderboard(
        {
          has_merged_pr_this_act: Boolean(user.has_merged_pr_this_act),
          current_tier: user.current_tier || 'UNRANKED',
          current_act_id: user.current_act_id,
        },
        actId
      )
    ) {
      continue;
    }
    const score = sums.get(user.id) ?? 0;
    await updateLeaderboardScore(key, user.id, score);
    entries.push({ userId: user.id, score });
  }
  return entries.sort((a, b) => b.score - a.score);
}

async function loadVisibleBoard(
  redisKey: string,
  cacheKey: string,
  actId: string,
  hydrateEmpty: () => Promise<{ userId: string; score: number }[]>
): Promise<CachedVisibleRow[]> {
  const cached = await cacheGet<CachedVisibleRow[]>(cacheKey);
  if (cached) return cached;

  let pageEntries = await getLeaderboardRange(redisKey, 0, -1);
  if (pageEntries.length === 0) {
    pageEntries = await hydrateEmpty();
  }

  if (pageEntries.length === 0) {
    await cacheSet(cacheKey, [], config.LEADERBOARD_CACHE_TTL_SECONDS);
    return [];
  }

  const userIds = pageEntries.map((e) => e.userId);
  const { data: users, error } = await supabase
    .from('users')
    .select(
      'id, github_username, avatar_url, current_tier, has_merged_pr_this_act, current_act_id'
    )
    .in('id', userIds);

  if (error) throw error;

  const byId = new Map<string, UserVisibilityRow>(
    ((users ?? []) as UserVisibilityRow[]).map((u) => [u.id, u])
  );

  const visible: CachedVisibleRow[] = [];
  const ghosts: string[] = [];

  for (const entry of pageEntries) {
    const user = byId.get(entry.userId);
    if (
      !user ||
      !isVisibleOnLeaderboard(
        {
          has_merged_pr_this_act: Boolean(user.has_merged_pr_this_act),
          current_tier: user.current_tier || 'UNRANKED',
          current_act_id: user.current_act_id,
        },
        actId
      )
    ) {
      ghosts.push(entry.userId);
      continue;
    }

    visible.push({
      userId: entry.userId,
      github_username: user.github_username || 'unknown',
      avatar_url: user.avatar_url || null,
      xp: entry.score,
      tier: user.current_tier || 'UNRANKED',
    });
  }

  if (ghosts.length > 0) {
    await removeLeaderboardMembers(redisKey, ghosts);
  }

  await cacheSet(cacheKey, visible, config.LEADERBOARD_CACHE_TTL_SECONDS);
  return visible;
}

function paginate(
  rows: CachedVisibleRow[],
  page: number,
  limit: number
): { data: LeaderboardRow[]; total: number } {
  const total = rows.length;
  const start = (page - 1) * limit;
  const slice = rows.slice(start, start + limit);
  const data = slice.map((row, index) => ({
    ...row,
    rank: start + index + 1,
  }));
  return { data, total };
}

async function standingForUser(
  rows: CachedVisibleRow[],
  userId: string
): Promise<ViewerStanding> {
  const idx = rows.findIndex((row) => row.userId === userId);
  if (idx >= 0) {
    return {
      rank: idx + 1,
      xp: rows[idx].xp,
      tier: rows[idx].tier,
      visible: true,
    };
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('global_xp, current_tier')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  return {
    rank: null,
    xp: user?.global_xp ?? 0,
    tier: user?.current_tier || 'UNRANKED',
    visible: false,
  };
}

export async function getGlobalLeaderboard(
  actId: string,
  page = 1,
  limit = 10,
  viewerId?: string
) {
  const key = globalLeaderboardKey(actId);
  const rows = await loadVisibleBoard(
    key,
    visibleLeaderboardCacheKey('global', actId),
    actId,
    () => hydrateGlobalFromDb(actId)
  );
  const paged = paginate(rows, page, limit);
  const me = viewerId ? await standingForUser(rows, viewerId) : undefined;
  return { ...paged, me };
}

export async function getOrgLeaderboard(
  orgId: string,
  actId: string,
  page = 1,
  limit = 10,
  viewerId?: string
) {
  const key = orgLeaderboardKey(orgId, actId);
  const rows = await loadVisibleBoard(
    key,
    visibleLeaderboardCacheKey('org', actId, orgId),
    actId,
    () => hydrateOrgFromDb(orgId, actId)
  );
  const paged = paginate(rows, page, limit);
  const me = viewerId ? await standingForUser(rows, viewerId) : undefined;
  return { ...paged, me };
}

export async function getUserGlobalRank(userId: string, actId: string) {
  const key = globalLeaderboardKey(actId);
  const rank = await getUserRank(key, userId);
  const score = await getUserScore(key, userId);

  return {
    rank,
    score: score !== null ? score : 0,
  };
}
