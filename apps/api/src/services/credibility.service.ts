import { createSupabaseAdmin } from '@pullquest/database';
import { TREASURY_DEBT_CEILING } from '@pullquest/shared';
import { cacheGet, cacheSet } from '../redis/cache.js';

const supabase = createSupabaseAdmin();

export async function calculateCredibilityScore(orgId: string): Promise<number> {
  // 1. Fetch treasury
  const { data: treasury } = await supabase
    .from('treasuries')
    .select('balance')
    .eq('org_id', orgId)
    .single();

  const balance = treasury ? treasury.balance : 0;
  let treasuryPoints = 40; // max 40%

  if (balance < 0) {
    // scale linearly from 40 down to 0 at the debt ceiling (-2000)
    const ratio = Math.max(0, 1 - balance / TREASURY_DEBT_CEILING);
    treasuryPoints = Math.floor(ratio * 40);
  }

  // 2. Contributor count (max 20%)
  const { count: contributorsCount } = await supabase
    .from('xp_logs')
    .select('user_id', { count: 'exact', head: true })
    .eq('org_id', orgId);

  const contributors = contributorsCount || 0;
  const contributorPoints = Math.min(20, contributors * 2);

  // 3. Repo count (max 20%)
  const { count: reposCount } = await supabase
    .from('repositories')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId);

  const repos = reposCount || 0;
  const repoPoints = Math.min(20, repos * 4);

  // 4. Activity consistency: merged PRs in last 30 days (max 20%)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { count: prCount } = await supabase
    .from('pull_requests')
    .select('id', { count: 'exact', head: true })
    .eq('outcome', 'MERGED')
    .gt('merged_at', thirtyDaysAgo.toISOString());

  const activePRs = prCount || 0;
  const activityPoints = Math.min(20, activePRs * 4);

  const totalScore = treasuryPoints + contributorPoints + repoPoints + activityPoints;
  const score = Math.max(0, Math.min(100, totalScore));

  // Save to database org record
  await supabase
    .from('organizations')
    .update({ credibility_score: score })
    .eq('id', orgId);

  // Cache in Redis for 15 mins (900 seconds)
  await cacheSet(`credibility:${orgId}`, score, 900);

  return score;
}

export async function getCachedCredibility(orgId: string): Promise<number> {
  const cacheKey = `credibility:${orgId}`;
  const cached = await cacheGet<number>(cacheKey);

  if (cached !== null) {
    return cached;
  }

  // Recalculate if cache miss
  return await calculateCredibilityScore(orgId);
}
