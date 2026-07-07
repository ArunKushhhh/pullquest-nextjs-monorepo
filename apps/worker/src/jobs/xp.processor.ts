import { Job } from 'bullmq';
import { createSupabaseAdmin } from '@pullquest/database';
import {
  calculateXP,
  getTierForXP,
  getTrustMultiplier,
  Difficulty,
} from '@pullquest/shared';

const supabase = createSupabaseAdmin();

export default async function processXP(job: Job): Promise<void> {
  const { prId, evaluationScore } = job.data;
  console.log(`[Worker XP Job]: Processing PR ID: ${prId}, score: ${evaluationScore}`);

  // 1. Fetch Pull Request
  const { data: pr, error: prErr } = await supabase
    .from('pull_requests')
    .select('*')
    .eq('id', prId)
    .single();

  if (prErr || !pr) throw prErr || new Error('Pull Request not found');

  // 2. Fetch Issue and Repo details
  const { data: issue, error: issueErr } = await supabase
    .from('issues')
    .select('*, repositories(github_repo_id, star_count, member_count, org_id)')
    .eq('id', pr.issue_id)
    .single();

  if (issueErr || !issue) throw issueErr || new Error('Issue details not found');

  const repo = (issue as any).repositories;
  if (!repo) throw new Error('Repository details not found');

  // 3. Compute trust multiplier and XP
  const trustMultiplier = getTrustMultiplier(repo.member_count || 0, repo.star_count || 0);
  const difficulty = issue.difficulty as Difficulty;
  const xpAwarded = calculateXP(difficulty, evaluationScore, trustMultiplier);

  // 4. Load Contributor profile
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('*')
    .eq('id', pr.user_id)
    .single();

  if (userErr || !user) throw userErr || new Error('Contributor profile not found');

  const tierBefore = user.current_tier;
  const globalXpAfter = user.global_xp + xpAwarded;
  const tierAfter = getTierForXP(globalXpAfter);

  // 5. Update user global statistics in Supabase
  const { error: userUpdateErr } = await supabase
    .from('users')
    .update({
      global_xp: globalXpAfter,
      current_tier: tierAfter,
    })
    .eq('id', pr.user_id);

  if (userUpdateErr) throw userUpdateErr;

  // 6. Get active seasonal Act
  const { data: activeAct } = await supabase
    .from('acts')
    .select('id')
    .eq('status', 'ACTIVE')
    .order('act_number', { ascending: false })
    .limit(1)
    .single();

  const actId = activeAct ? activeAct.id : '00000000-0000-0000-0000-000000000000';

  // 7. Log history to xp_logs table
  await supabase.from('xp_logs').insert({
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
  });

  await job.updateProgress(100);
}
