import { createSupabaseAdmin } from '@pullquest/database';
import { getUserRank } from '../redis/leaderboard.js';

const supabase = createSupabaseAdmin();

export async function getUserProfile(userId: string) {
  // 1. Fetch user base info
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id, github_username, avatar_url, role, global_xp, current_tier, created_at')
    .eq('id', userId)
    .single();

  if (userErr || !user) {
    if (userErr?.code === 'PGRST116') return null;
    throw userErr || new Error('User not found');
  }

  // 2. Fetch current active Act
  const { data: activeAct } = await supabase
    .from('acts')
    .select('id')
    .eq('status', 'ACTIVE')
    .order('act_number', { ascending: false })
    .limit(1)
    .single();

  let rank: number | null = null;
  if (activeAct) {
    rank = await getUserRank(`leaderboard:global:${activeAct.id}`, userId);
  }

  return {
    ...user,
    rank,
  };
}

export async function getUserPRHistory(userId: string, page = 1, limit = 10) {
  const start = (page - 1) * limit;
  const end = start + limit - 1;

  // Fetch PRs with linked repositories and evaluations
  const { data: prs, error, count } = await supabase
    .from('pull_requests')
    .select(
      '*, repositories(name, full_name), evaluations(total_score, comments, code_quality_score, complexity_score, test_coverage_score, documentation_score, overall_score)',
      { count: 'exact' }
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(start, end);

  if (error) throw error;

  return {
    data: prs || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

export async function getUserStakeHistory(userId: string, page = 1, limit = 10) {
  const start = (page - 1) * limit;
  const end = start + limit - 1;

  const { data: stakes, error, count } = await supabase
    .from('stakes')
    .select('*, issues(title, github_issue_number, difficulty, repositories(full_name))', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(start, end);

  if (error) throw error;

  return {
    data: stakes || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  };
}
