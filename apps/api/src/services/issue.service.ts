import { createSupabaseAdmin } from '@pullquest/database';
import { Issue, Difficulty } from '@pullquest/shared';

const supabase = createSupabaseAdmin();

export async function registerIssue(data: {
  github_issue_id: number;
  github_issue_number: number;
  repo_id: string;
  org_id: string | null;
  title: string;
  url: string;
  stake_amount: number;
  difficulty: Difficulty;
  trust_multiplier: number;
}): Promise<Issue> {
  const { data: issue, error } = await supabase
    .from('issues')
    .upsert(
      {
        github_issue_id: data.github_issue_id,
        github_issue_number: data.github_issue_number,
        repo_id: data.repo_id,
        org_id: data.org_id,
        title: data.title,
        url: data.url,
        stake_amount: data.stake_amount,
        difficulty: data.difficulty,
        trust_multiplier: data.trust_multiplier,
        is_open: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'github_issue_id' }
    )
    .select('*')
    .single();

  if (error) throw error;
  return issue as Issue;
}

export async function getIssueById(id: string): Promise<Issue | null> {
  const { data, error } = await supabase
    .from('issues')
    .select('*, repositories(name, full_name)')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as Issue;
}

export async function getStakableIssues(
  filters: { org_id?: string; difficulty?: Difficulty; is_open?: boolean },
  page = 1,
  limit = 10
): Promise<{ data: Issue[]; total: number }> {
  let query = supabase
    .from('issues')
    .select('*, repositories(name, full_name)', { count: 'exact' });

  if (filters.org_id) {
    query = query.eq('org_id', filters.org_id);
  }
  if (filters.difficulty) {
    query = query.eq('difficulty', filters.difficulty);
  }
  if (filters.is_open !== undefined) {
    query = query.eq('is_open', filters.is_open);
  }

  const start = (page - 1) * limit;
  const end = start + limit - 1;

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(start, end);

  if (error) throw error;
  return {
    data: (data || []) as Issue[],
    total: count || 0,
  };
}
export async function closeIssue(githubIssueId: number): Promise<void> {
  await supabase
    .from('issues')
    .update({ is_open: false })
    .eq('github_issue_id', githubIssueId);
}
