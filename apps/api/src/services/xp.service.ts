import { createSupabaseAdmin } from '@pullquest/database';
import {
  calculateXP,
  getTierForXP,
  getTrustMultiplier,
  Difficulty,
  XPLog,
} from '@pullquest/shared';
import { updateLeaderboardScore } from '../redis/leaderboard.js';
import { xpAwardedTotal } from '../metrics/definitions.js';
import { getPRById } from './pr.service.js';

const supabase = createSupabaseAdmin();

export async function calculateAndAwardXP(
  prId: string,
  evaluationScore: number
): Promise<XPLog> {
  // Load PR with issue and repository details
  const pr = await getPRById(prId);
  if (!pr) throw new Error('PR not found');

  const { data: issue } = await supabase
    .from('issues')
    .select('*, repositories(github_repo_id, star_count, member_count, org_id)')
    .eq('id', pr.issue_id)
    .single();

  if (!issue) throw new Error('Issue not found');

  const repo = (issue as any).repositories;
  if (!repo) throw new Error('Repository details not found');

  // 1. Calculate Trust Multiplier
  const trustMultiplier = getTrustMultiplier(repo.member_count || 0, repo.star_count || 0);
  const difficulty = issue.difficulty as Difficulty;

  // 2. Calculate Final XP
  const xpAwarded = calculateXP(difficulty, evaluationScore, trustMultiplier);

  // 3. Fetch Contributor User Profile
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('*')
    .eq('id', pr.user_id)
    .single();

  if (userErr || !user) throw userErr || new Error('User not found');

  const tierBefore = user.current_tier;
  const globalXpAfter = user.global_xp + xpAwarded;
  const tierAfter = getTierForXP(globalXpAfter);

  // 4. Update User Profile in DB
  const { error: userUpdateErr } = await supabase
    .from('users')
    .update({
      global_xp: globalXpAfter,
      current_tier: tierAfter,
    })
    .eq('id', pr.user_id);

  if (userUpdateErr) throw userUpdateErr;

  // Get current seasonal Act
  const { data: activeAct } = await supabase
    .from('acts')
    .select('id')
    .eq('status', 'ACTIVE')
    .order('act_number', { ascending: false })
    .limit(1)
    .single();

  const actId = activeAct ? activeAct.id : '00000000-0000-0000-0000-000000000000';

  // 5. Create XP Log entry
  const { data: logEntry, error: logErr } = await supabase
    .from('xp_logs')
    .insert({
      user_id: pr.user_id,
      pr_id: pr.id,
      issue_id: pr.issue_id,
      act_id: actId,
      org_id: repo.org_id || null,
      difficulty,
      xp_cap: difficulty === 'EASY' ? 40 : difficulty === 'MEDIUM' ? 70 : 100,
      evaluation_score: evaluationScore,
      trust_multiplier: trustMultiplier,
      xp_awarded: xpAwarded,
      global_xp_after: globalXpAfter,
      tier_before: tierBefore,
      tier_after: tierAfter,
    })
    .select('*')
    .single();

  if (logErr) throw logErr;

  // 6. Update Redis Leaderboards (Global and Org-specific)
  try {
    await updateLeaderboardScore(`leaderboard:global:${actId}`, pr.user_id, globalXpAfter);
    if (repo.org_id) {
      await updateLeaderboardScore(
        `leaderboard:org:${repo.org_id}:${actId}`,
        pr.user_id,
        globalXpAfter
      );
    }
  } catch (redisErr) {
    console.error('[XP Service]: Redis leaderboard update failed:', redisErr);
  }

  // 7. Emit Prometheus metrics
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
