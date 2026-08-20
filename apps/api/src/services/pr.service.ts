import { createSupabaseAdmin } from '@pullquest/database';
import {
  PullRequest,
  PROutcome,
  PRStatus,
  StakeStatus,
  CoinTransactionType,
  Difficulty,
  classifyPROutcome,
  computePRFinancials,
  parseIssueNumbers,
} from '@pullquest/shared';
import { creditCoins, deductCoins, unlockCoins } from './coin.service.js';
import { resolveStake } from './stake.service.js';
import { creditTreasury, debitTreasury } from './treasury.service.js';
import { prOutcomesTotal } from '../metrics/definitions.js';
import { aiSummaryQueue } from '../config/queues.js';

const supabase = createSupabaseAdmin();

const ACCEPTED_OUTCOMES = [PROutcome.MERGED, PROutcome.MULTIPLE_ACCEPTED];

type IssueJoin = { org_id: string | null; difficulty: Difficulty | null };

function issueJoin(pr: PullRequest & { issues?: IssueJoin | IssueJoin[] | null }): IssueJoin {
  const raw = pr.issues;
  if (Array.isArray(raw)) return raw[0] ?? { org_id: null, difficulty: null };
  return raw ?? { org_id: null, difficulty: null };
}

export async function getPRById(id: string): Promise<PullRequest | null> {
  const { data, error } = await supabase
    .from('pull_requests')
    .select('*, issues(org_id, difficulty)')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as PullRequest;
}

export async function registerPR(data: {
  github_pr_id: number;
  github_pr_number: number;
  issue_id: string;
  user_id: string;
  repo_id: string;
  title: string;
  url: string;
  body?: string | null;
}): Promise<PullRequest> {
  const { data: pr, error } = await supabase
    .from('pull_requests')
    .upsert(
      {
        github_pr_id: data.github_pr_id,
        github_pr_number: data.github_pr_number,
        issue_id: data.issue_id,
        user_id: data.user_id,
        repo_id: data.repo_id,
        title: data.title,
        url: data.url,
        status: PRStatus.OPEN,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'github_pr_id' }
    )
    .select('*')
    .single();

  if (error) throw error;

  if (!pr.ai_summary) {
    try {
      await aiSummaryQueue.add('summarize-pr', {
        type: 'pull_request',
        id: pr.id,
        title: data.title,
        body: data.body ?? '',
      });
    } catch (err) {
      console.error('[PR Service]: Failed to enqueue AI summary:', err);
    }
  }

  return pr as PullRequest;
}

async function loadLockedStake(userId: string, issueId: string) {
  const { data, error } = await supabase
    .from('stakes')
    .select('*')
    .eq('user_id', userId)
    .eq('issue_id', issueId)
    .eq('status', StakeStatus.LOCKED)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function countAcceptedPRs(issueId: string, excludingPrId?: string): Promise<number> {
  let query = supabase
    .from('pull_requests')
    .select('id', { count: 'exact', head: true })
    .eq('issue_id', issueId)
    .in('outcome', ACCEPTED_OUTCOMES);

  if (excludingPrId) {
    query = query.neq('id', excludingPrId);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function markSiblingPRsMultipleAccepted(issueId: string, currentPrId: string): Promise<void> {
  const { error } = await supabase
    .from('pull_requests')
    .update({ outcome: PROutcome.MULTIPLE_ACCEPTED })
    .eq('issue_id', issueId)
    .in('outcome', ACCEPTED_OUTCOMES)
    .neq('id', currentPrId);

  if (error) throw error;
}

async function applyFinancials(
  pr: PullRequest,
  orgId: string | null,
  difficulty: Difficulty,
  outcome: PROutcome,
  acceptedCount: number
): Promise<void> {
  const stake = await loadLockedStake(pr.user_id, pr.issue_id);
  const stakeAmount = stake?.amount ?? 0;
  const financials = computePRFinancials({
    outcome,
    stakeAmount,
    difficulty,
    acceptedCount,
  });

  if (stake && financials.releaseLocked) {
    // Return the full locked amount first, then apply deduction / bonus / compensation.
    await unlockCoins(pr.user_id, stake.amount, pr.id);

    if (financials.deductionToTreasury > 0) {
      await deductCoins(
        pr.user_id,
        financials.deductionToTreasury,
        CoinTransactionType.STAKE_DEDUCTION,
        pr.id,
        `PR rejected: ${financials.deductionToTreasury} coins deducted`
      );
      if (orgId) {
        await creditTreasury(
          orgId,
          financials.deductionToTreasury,
          `Deduction from rejected PR #${pr.github_pr_number}`
        );
      }
    }

    await resolveStake(stake.id, financials.stakeStatus);
  }

  if (stake && financials.mergeBonus > 0) {
    const { count: existingBonus, error: bonusLookupError } = await supabase
      .from('coin_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('reference_id', pr.id)
      .eq('type', CoinTransactionType.MERGE_BONUS);

    if (bonusLookupError) throw bonusLookupError;

    if (!existingBonus) {
      await creditCoins(
        pr.user_id,
        financials.mergeBonus,
        CoinTransactionType.MERGE_BONUS,
        pr.id,
        outcome === PROutcome.MULTIPLE_ACCEPTED
          ? `Split merge bonus (${acceptedCount} accepted PRs) for ${difficulty}`
          : `Merge bonus reward for ${difficulty} difficulty`
      );
    }
  }

  if (orgId && financials.compensationFromTreasury > 0) {
    try {
      await debitTreasury(
        orgId,
        financials.compensationFromTreasury,
        `Compensation for closed PR #${pr.github_pr_number}`
      );
      await creditCoins(
        pr.user_id,
        financials.compensationFromTreasury,
        CoinTransactionType.TREASURY_COMPENSATION,
        pr.id,
        'Received treasury compensation for closed-without-merge PR'
      );
    } catch (err) {
      console.error('[PR Service]: Treasury compensation failed:', err);
    }
  }
}

async function persistOutcome(
  prId: string,
  outcome: PROutcome,
  merged: boolean
): Promise<PullRequest> {
  const awaitingEval =
    outcome === PROutcome.MERGED || outcome === PROutcome.MULTIPLE_ACCEPTED;

  const now = new Date().toISOString();
  const patch: Record<string, string> = {
    outcome,
    status: awaitingEval ? PRStatus.AWAITING_EVALUATION : PRStatus.RESOLVED,
    closed_at: now,
  };
  if (merged) patch.merged_at = now;

  const { data: updatedPR, error: updateError } = await supabase
    .from('pull_requests')
    .update(patch)
    .eq('id', prId)
    .select('*')
    .single();

  if (updateError) throw updateError;
  prOutcomesTotal.inc({ outcome });
  return updatedPR as PullRequest;
}

export async function resolvePR(prId: string, merged: boolean): Promise<PullRequest> {
  const pr = await getPRById(prId);
  if (!pr) throw new Error('PR not found');

  if (pr.outcome && pr.status !== PRStatus.OPEN) {
    console.log(`[PR Service]: PR ${prId} already resolved as ${pr.outcome}; skipping`);
    return pr;
  }

  const issues = issueJoin(pr as PullRequest & { issues?: IssueJoin });
  const difficulty = issues.difficulty || Difficulty.EASY;
  const orgId = issues.org_id;

  const priorAccepted = merged ? await countAcceptedPRs(pr.issue_id, pr.id) : 0;
  const acceptedCount = merged ? priorAccepted + 1 : 0;
  const outcome = classifyPROutcome({
    merged,
    lastReviewStatus: pr.last_review_status,
    acceptedCount,
  });

  await applyFinancials(pr, orgId, difficulty, outcome, acceptedCount);

  if (merged) {
    await supabase
      .from('users')
      .update({ has_merged_pr_this_act: true })
      .eq('id', pr.user_id);
  }

  const updated = await persistOutcome(prId, outcome, merged);

  if (outcome === PROutcome.MULTIPLE_ACCEPTED) {
    await markSiblingPRsMultipleAccepted(pr.issue_id, pr.id);
  }

  return updated;
}

export async function handlePRMerged(prId: string): Promise<PullRequest> {
  return resolvePR(prId, true);
}

export async function handlePRRejected(prId: string): Promise<PullRequest> {
  return resolvePR(prId, false);
}

export async function handlePRClosed(prId: string): Promise<PullRequest> {
  return resolvePR(prId, false);
}

async function findStakedIssueForUser(
  repoId: string,
  userId: string,
  issueNumbers: number[]
): Promise<{ id: string } | null> {
  for (const issueNumber of issueNumbers) {
    const { data: issue, error } = await supabase
      .from('issues')
      .select('id')
      .eq('repo_id', repoId)
      .eq('github_issue_number', issueNumber)
      .maybeSingle();

    if (error) throw error;
    if (!issue) continue;

    const stake = await loadLockedStake(userId, issue.id);
    if (stake) return issue;
  }
  return null;
}

export async function handlePullRequestGitHubEvent(
  event: string,
  payload: {
    action?: string;
    pull_request?: {
      id: number;
      number: number;
      title: string;
      html_url: string;
      body?: string | null;
      merged?: boolean;
      user?: { id: number };
    };
    review?: { state?: string };
    repository?: { id: number };
    sender?: { id: number };
  }
): Promise<void> {
  const pullRequest = payload.pull_request;
  const repository = payload.repository;
  if (!pullRequest || !repository) return;

  if (event === 'pull_request_review') {
    if (payload.action !== 'submitted') return;
    const status = (payload.review?.state ?? '').toLowerCase();
    const { data: pr, error } = await supabase
      .from('pull_requests')
      .select('id')
      .eq('github_pr_id', pullRequest.id)
      .maybeSingle();
    if (error) throw error;
    if (!pr || !status) return;

    const { error: updateError } = await supabase
      .from('pull_requests')
      .update({ last_review_status: status })
      .eq('id', pr.id);
    if (updateError) throw updateError;
    console.log(
      `[PR Service]: Updated PR #${pullRequest.number} review status to "${status}"`
    );
    return;
  }

  const action = payload.action;
  const senderGithubId = payload.sender?.id ?? pullRequest.user?.id;
  if (!senderGithubId) return;

  if (action === 'opened' || action === 'reopened' || action === 'edited') {
    const { data: repo, error: repoError } = await supabase
      .from('repositories')
      .select('id')
      .eq('github_repo_id', repository.id)
      .maybeSingle();
    if (repoError) throw repoError;
    if (!repo) {
      console.log(
        `[PR Service]: Repo github_repo_id=${repository.id} not indexed; ignoring PR #${pullRequest.number}`
      );
      return;
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('github_id', senderGithubId)
      .maybeSingle();
    if (userError) throw userError;
    if (!user) {
      console.log(
        `[PR Service]: GitHub user ${senderGithubId} has no PullQuest account; ignoring PR #${pullRequest.number}`
      );
      return;
    }

    const issueNumbers = parseIssueNumbers(
      `${pullRequest.title ?? ''}\n${pullRequest.body ?? ''}`
    );
    if (issueNumbers.length === 0) {
      console.log(
        `[PR Service]: PR #${pullRequest.number} has no #issue ref; not linking`
      );
      return;
    }

    const issue = await findStakedIssueForUser(repo.id, user.id, issueNumbers);
    if (!issue) {
      console.log(
        `[PR Service]: PR #${pullRequest.number} did not match a LOCKED stake; not linking`
      );
      return;
    }

    const { data: existing } = await supabase
      .from('pull_requests')
      .select('id, status, outcome')
      .eq('github_pr_id', pullRequest.id)
      .maybeSingle();
    if (existing?.outcome || (existing && existing.status !== PRStatus.OPEN)) {
      console.log(
        `[PR Service]: PR #${pullRequest.number} already resolved; ignoring ${action}`
      );
      return;
    }

    const pr = await registerPR({
      github_pr_id: pullRequest.id,
      github_pr_number: pullRequest.number,
      issue_id: issue.id,
      user_id: user.id,
      repo_id: repo.id,
      title: pullRequest.title,
      url: pullRequest.html_url,
      body: pullRequest.body,
    });
    console.log(
      `[PR Service]: Linked PR #${pullRequest.number} to staked issue ${issue.id} (${pr.id})`
    );
    return;
  }

  if (action === 'closed') {
    const { data: pr, error } = await supabase
      .from('pull_requests')
      .select('id')
      .eq('github_pr_id', pullRequest.id)
      .maybeSingle();
    if (error) throw error;
    if (!pr) {
      console.log(
        `[PR Service]: Closed PR #${pullRequest.number} is not linked; ignoring`
      );
      return;
    }

    const resolved = await resolvePR(pr.id, Boolean(pullRequest.merged));
    console.log(
      `[PR Service]: Resolved PR #${pullRequest.number} as ${resolved.outcome}`
    );
  }
}
