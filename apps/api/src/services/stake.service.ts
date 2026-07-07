import { createSupabaseAdmin } from '@pullquest/database';
import { Stake, StakeStatus } from '@pullquest/shared';
import { validateStakeAmount } from '@pullquest/shared';
import { lockCoins, unlockCoins } from './coin.service.js';
import { getIssueById } from './issue.service.js';

const supabase = createSupabaseAdmin();

export async function getUserStakes(userId: string): Promise<Stake[]> {
  const { data, error } = await supabase
    .from('stakes')
    .select('*, issues(title, github_issue_number, difficulty)')
    .eq('user_id', userId);

  if (error) throw error;
  return data as Stake[];
}

export async function getStakeById(id: string): Promise<Stake | null> {
  const { data, error } = await supabase
    .from('stakes')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as Stake;
}

export async function stakeOnIssue(
  userId: string,
  issueId: string,
  amount: number
): Promise<Stake> {
  // Fetch issue details
  const issue = await getIssueById(issueId);
  if (!issue) {
    throw new Error('Issue not found');
  }
  if (!issue.is_open) {
    throw new Error('Issue is closed for staking');
  }

  // Validate amount matches issue difficulty band
  if (!validateStakeAmount(amount, issue.difficulty)) {
    throw new Error(`Invalid stake amount for difficulty ${issue.difficulty}`);
  }

  // Check if user already staked on this issue
  const { data: existingStake } = await supabase
    .from('stakes')
    .select('id')
    .eq('user_id', userId)
    .eq('issue_id', issueId)
    .single();

  if (existingStake) {
    throw new Error('User has already placed a stake on this issue');
  }

  // Deduct/Lock user coins first (throws if insufficient)
  // We reference the stake ID if we can, but since we haven't inserted the record yet,
  // we do the lock first and insert the stake.
  await lockCoins(userId, amount);

  // Insert stake record
  const { data: newStake, error: insertError } = await supabase
    .from('stakes')
    .insert({
      user_id: userId,
      issue_id: issueId,
      amount,
      status: StakeStatus.LOCKED,
    })
    .select('*')
    .single();

  if (insertError) {
    // Rollback locked coins if database insertion fails
    await unlockCoins(userId, amount);
    throw insertError;
  }

  return newStake as Stake;
}

export async function resolveStake(
  stakeId: string,
  status: StakeStatus
): Promise<Stake> {
  const { data: updated, error } = await supabase
    .from('stakes')
    .update({
      status,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', stakeId)
    .select('*')
    .single();

  if (error) throw error;
  return updated as Stake;
}
