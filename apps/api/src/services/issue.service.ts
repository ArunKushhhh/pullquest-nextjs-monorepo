import { createSupabaseAdmin } from '@pullquest/database';
import { Difficulty, Issue, StakableIssue } from '@pullquest/shared';
import {
  ISSUE_CACHE_TTL_SECONDS,
  cacheHashSet,
  issueCacheKey,
} from '../redis/cache.js';

const supabase = createSupabaseAdmin();

const ISSUE_LIST_SELECT =
  '*, repositories(name, full_name), organizations(name, credibility_score)';

export async function cacheIssueMetadata(issue: {
  id: string;
  stake_amount: number;
  difficulty: Difficulty;
  is_open: boolean;
  participant_count: number;
}): Promise<void> {
  await cacheHashSet(
    issueCacheKey(issue.id),
    {
      stake_amount: String(issue.stake_amount),
      difficulty: issue.difficulty,
      is_open: String(issue.is_open),
      participants: String(issue.participant_count),
    },
    ISSUE_CACHE_TTL_SECONDS
  );
}

async function countLockedParticipants(issueId: string): Promise<number> {
  const { count, error } = await supabase
    .from('stakes')
    .select('id', { count: 'exact', head: true })
    .eq('issue_id', issueId)
    .eq('status', 'LOCKED');

  if (error) throw error;
  return count ?? 0;
}

function withParticipantCount(
  issue: StakableIssue,
  participant_count: number
): StakableIssue {
  return { ...issue, participant_count };
}

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

  const registered = issue as Issue;
  await cacheIssueMetadata({
    id: registered.id,
    stake_amount: registered.stake_amount,
    difficulty: registered.difficulty,
    is_open: registered.is_open,
    participant_count: 0,
  });

  return registered;
}

export async function getIssueById(id: string): Promise<StakableIssue | null> {
  const { data, error } = await supabase
    .from('issues')
    .select(ISSUE_LIST_SELECT)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  const issue = data as StakableIssue;
  const participant_count = await countLockedParticipants(id);
  await cacheIssueMetadata({
    id: issue.id,
    stake_amount: issue.stake_amount,
    difficulty: issue.difficulty,
    is_open: issue.is_open,
    participant_count,
  });

  return withParticipantCount(issue, participant_count);
}

export async function getStakableIssues(
  filters: { org_id?: string; difficulty?: Difficulty; is_open?: boolean },
  page = 1,
  limit = 10
): Promise<{ data: StakableIssue[]; total: number }> {
  let query = supabase
    .from('issues')
    .select(ISSUE_LIST_SELECT, { count: 'exact' });

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

  const rows = (data || []) as StakableIssue[];
  const withCounts = await Promise.all(
    rows.map(async (issue) =>
      withParticipantCount(issue, await countLockedParticipants(issue.id))
    )
  );

  return {
    data: withCounts,
    total: count || 0,
  };
}

export async function closeIssue(githubIssueId: number): Promise<void> {
  const { data, error } = await supabase
    .from('issues')
    .update({ is_open: false })
    .eq('github_issue_id', githubIssueId)
    .select('id, stake_amount, difficulty')
    .maybeSingle();

  if (error) throw error;
  if (!data) return;

  const participant_count = await countLockedParticipants(data.id);
  await cacheIssueMetadata({
    id: data.id,
    stake_amount: data.stake_amount,
    difficulty: data.difficulty as Difficulty,
    is_open: false,
    participant_count,
  });
}
