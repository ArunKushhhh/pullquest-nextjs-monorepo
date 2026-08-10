import { createSupabaseAdmin } from '@pullquest/database';
import {
  PullRequest,
  PROutcome,
  PRStatus,
  StakeStatus,
  CoinTransactionType,
  MERGE_BONUS,
  calculateRejectionDeduction,
  calculateClosedCompensation,
  Difficulty,
} from '@pullquest/shared';
import { creditCoins, unlockCoins } from './coin.service.js';
import { resolveStake } from './stake.service.js';
import { creditTreasury, debitTreasury } from './treasury.service.js';
import { prOutcomesTotal } from '../metrics/definitions.js';

const supabase = createSupabaseAdmin();

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
  return pr as PullRequest;
}

export async function handlePRMerged(prId: string): Promise<PullRequest> {
  const pr = await getPRById(prId);
  if (!pr) throw new Error('PR not found');

  // Load the user's stake on the linked issue
  const { data: stake, error: stakeErr } = await supabase
    .from('stakes')
    .select('*')
    .eq('user_id', pr.user_id)
    .eq('issue_id', pr.issue_id)
    .eq('status', StakeStatus.LOCKED)
    .single();

  const difficulty = ((pr as any).issues?.difficulty as Difficulty) || Difficulty.EASY;

  // 1. Resolve and unlock user's stake
  if (stake && !stakeErr) {
    await unlockCoins(pr.user_id, stake.amount, pr.id);
    await resolveStake(stake.id, StakeStatus.RETURNED);
  }

  // 2. Mint merge bonus coins for the contributor
  const bonus = MERGE_BONUS[difficulty] || 10;
  await creditCoins(
    pr.user_id,
    bonus,
    CoinTransactionType.MERGE_BONUS,
    pr.id,
    `Merge bonus reward for ${difficulty} difficulty`
  );

  // 3. Mark user's monthly progress
  await supabase
    .from('users')
    .update({ has_merged_pr_this_act: true })
    .eq('id', pr.user_id);

  // 4. Update PR status (maintainer evaluation is now awaited)
  const { data: updatedPR, error: updateError } = await supabase
    .from('pull_requests')
    .update({
      outcome: PROutcome.MERGED,
      status: PRStatus.AWAITING_EVALUATION,
      merged_at: new Date().toISOString(),
    })
    .eq('id', prId)
    .select('*')
    .single();

  if (updateError) throw updateError;
  prOutcomesTotal.inc({ outcome: PROutcome.MERGED });
  return updatedPR as PullRequest;
}

export async function handlePRRejected(prId: string): Promise<PullRequest> {
  const pr = await getPRById(prId);
  if (!pr) throw new Error('PR not found');

  const { data: stake, error: stakeErr } = await supabase
    .from('stakes')
    .select('*')
    .eq('user_id', pr.user_id)
    .eq('issue_id', pr.issue_id)
    .eq('status', StakeStatus.LOCKED)
    .single();

  const orgId = (pr as any).issues?.org_id;

  if (stake && !stakeErr) {
    const deduction = calculateRejectionDeduction(stake.amount);
    const refund = stake.amount - deduction;

    // Deduct 50% from locked: unlock only the remaining 50% refund
    if (refund > 0) {
      // Direct update of users' locked/earned balances
      const { data: user } = await supabase
        .from('users')
        .select('earned_coins, locked_coins')
        .eq('id', pr.user_id)
        .single();

      if (user) {
        await supabase
          .from('users')
          .update({
            earned_coins: user.earned_coins + refund,
            locked_coins: user.locked_coins - stake.amount,
          })
          .eq('id', pr.user_id);

        await supabase.from('coin_transactions').insert({
          user_id: pr.user_id,
          type: CoinTransactionType.STAKE_DEDUCTION,
          amount: -deduction,
          earned_balance_after: user.earned_coins + refund,
          purchased_balance_after: 0,
          locked_balance_after: user.locked_coins - stake.amount,
          reference_id: pr.id,
          description: `PR rejected: ${deduction} coins deducted`,
        });
      }
    }

    // Credit deducted coins to organization treasury
    if (orgId && deduction > 0) {
      await creditTreasury(orgId, deduction, `Deduction from rejected PR #${pr.github_pr_number}`);
    }

    await resolveStake(stake.id, StakeStatus.DEDUCTED);
  }

  const { data: updatedPR, error: updateError } = await supabase
    .from('pull_requests')
    .update({
      outcome: PROutcome.REJECTED,
      status: PRStatus.RESOLVED,
      closed_at: new Date().toISOString(),
    })
    .eq('id', prId)
    .select('*')
    .single();

  if (updateError) throw updateError;
  prOutcomesTotal.inc({ outcome: PROutcome.REJECTED });
  return updatedPR as PullRequest;
}

export async function handlePRClosed(prId: string): Promise<PullRequest> {
  const pr = await getPRById(prId);
  if (!pr) throw new Error('PR not found');

  const { data: stake, error: stakeErr } = await supabase
    .from('stakes')
    .select('*')
    .eq('user_id', pr.user_id)
    .eq('issue_id', pr.issue_id)
    .eq('status', StakeStatus.LOCKED)
    .single();

  const orgId = (pr as any).issues?.org_id;

  if (stake && !stakeErr) {
    // 1. Refund the full stake amount back to user
    await unlockCoins(pr.user_id, stake.amount, pr.id);
    await resolveStake(stake.id, StakeStatus.REFUNDED);

    // 2. Org pays 30% compensation to user
    if (orgId) {
      const compensation = calculateClosedCompensation(stake.amount);
      if (compensation > 0) {
        try {
          await debitTreasury(orgId, compensation, `Compensation to user for closed issue #${pr.github_pr_number}`);
          await creditCoins(
            pr.user_id,
            compensation,
            CoinTransactionType.TREASURY_COMPENSATION,
            pr.id,
            `Received treasury compensation for closed issue`
          );
        } catch (err) {
          console.error('[PR Service]: Treasury debit failed during PR close compensation:', err);
        }
      }
    }
  }

  const { data: updatedPR, error: updateError } = await supabase
    .from('pull_requests')
    .update({
      outcome: PROutcome.CLOSED_WITHOUT_MERGE,
      status: PRStatus.RESOLVED,
      closed_at: new Date().toISOString(),
    })
    .eq('id', prId)
    .select('*')
    .single();

  if (updateError) throw updateError;
  prOutcomesTotal.inc({ outcome: PROutcome.CLOSED_WITHOUT_MERGE });
  return updatedPR as PullRequest;
}
