import { createSupabaseAdmin } from '@pullquest/database';
import {
  calculateXP,
  getTierForXP,
  getTrustMultiplier,
  Difficulty,
  XPLog,
  XP_CAPS,
} from '@pullquest/shared';
import {
  incrementLeaderboardScore,
  invalidateLeaderboardCaches,
  orgLeaderboardKey,
  updateLeaderboardScore,
  globalLeaderboardKey,
} from '../redis/leaderboard.js';
import { xpAwardedTotal, leaderboardUpdateDuration } from '../metrics/definitions.js';
import { getPRById } from './pr.service.js';
import { ensureActiveAct } from './act.service.js';

const supabase = createSupabaseAdmin();

export async function getXpLogForPR(prId: string): Promise<XPLog | null> {
  const { data, error } = await supabase
    .from('xp_logs')
    .select('*')
    .eq('pr_id', prId)
    .maybeSingle();

  if (error) throw error;
  return (data as XPLog) ?? null;
}

export async function calculateAndAwardXP(
  prId: string,
  evaluationScore: number
): Promise<XPLog> {
  const existing = await getXpLogForPR(prId);
  if (existing) return existing;

  const pr = await getPRById(prId);
  if (!pr) throw new Error('PR not found');

  const { data: issue, error: issueErr } = await supabase
    .from('issues')
    .select('*, repositories(id, github_repo_id, star_count, member_count, org_id)')
    .eq('id', pr.issue_id)
    .single();

  if (issueErr || !issue) throw issueErr || new Error('Issue not found');

  const repo = Array.isArray((issue as { repositories?: unknown }).repositories)
    ? (issue as { repositories: Array<Record<string, unknown>> }).repositories[0]
    : (issue as { repositories: Record<string, unknown> | null }).repositories;
  if (!repo) throw new Error('Repository details not found');

  const memberCount = Number(repo.member_count || 0);
  const starCount = Number(repo.star_count || 0);
  const trustMultiplier = getTrustMultiplier(memberCount, starCount);
  const difficulty = issue.difficulty as Difficulty;
  const xpAwarded = calculateXP(difficulty, evaluationScore, trustMultiplier);

  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('*')
    .eq('id', pr.user_id)
    .single();

  if (userErr || !user) throw userErr || new Error('User not found');

  const tierBefore = user.current_tier;
  const globalXpAfter = user.global_xp + xpAwarded;
  const tierAfter = getTierForXP(globalXpAfter);
  const activeAct = await ensureActiveAct();
  const actId = activeAct.id;

  const { error: userUpdateErr } = await supabase
    .from('users')
    .update({
      global_xp: globalXpAfter,
      current_tier: tierAfter,
      has_merged_pr_this_act: true,
      current_act_id: actId,
    })
    .eq('id', pr.user_id);

  if (userUpdateErr) throw userUpdateErr;

  if (typeof repo.id === 'string') {
    await supabase
      .from('repositories')
      .update({ trust_multiplier: trustMultiplier })
      .eq('id', repo.id);
  }

  const { data: logEntry, error: logErr } = await supabase
    .from('xp_logs')
    .insert({
      user_id: pr.user_id,
      pr_id: pr.id,
      issue_id: pr.issue_id,
      act_id: actId,
      org_id: (repo.org_id as string | null) || null,
      difficulty,
      xp_cap: XP_CAPS[difficulty],
      evaluation_score: evaluationScore,
      trust_multiplier: trustMultiplier,
      xp_awarded: xpAwarded,
      global_xp_after: globalXpAfter,
      tier_before: tierBefore,
      tier_after: tierAfter,
    })
    .select('*')
    .single();

  if (logErr) {
    if (logErr.code === '23505') {
      const raced = await getXpLogForPR(prId);
      if (raced) return raced;
    }
    throw logErr;
  }

  const endLeaderboardTimer = leaderboardUpdateDuration.startTimer();
  try {
    await updateLeaderboardScore(globalLeaderboardKey(actId), pr.user_id, globalXpAfter);
    if (repo.org_id) {
      await incrementLeaderboardScore(
        orgLeaderboardKey(repo.org_id as string, actId),
        pr.user_id,
        xpAwarded
      );
    }
    await invalidateLeaderboardCaches(actId, (repo.org_id as string | null) || null);
  } catch (redisErr) {
    console.error('[XP Service]: Redis leaderboard update failed:', redisErr);
  } finally {
    endLeaderboardTimer();
  }

  xpAwardedTotal.inc(xpAwarded);

  return logEntry as XPLog;
}

export async function getXpLogs(userId: string): Promise<XPLog[]> {
  const { data, error } = await supabase
    .from('xp_logs')
    .select('*, issues(title, github_issue_number)')
    .eq('user_id', userId);

  if (error) throw error;
  return data as XPLog[];
}
