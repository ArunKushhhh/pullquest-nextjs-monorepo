import {
  Difficulty,
  Stake,
  StakeStatus,
  evaluateStakeAttempt,
  type StakeRejectionCode,
} from '@pullquest/shared';
import { createSupabaseAdmin } from '@pullquest/database';
import { lockCoins, unlockCoins } from './coin.service.js';
import { cacheIssueMetadata, getIssueById } from './issue.service.js';
import { isStakingDisabled } from './treasury.service.js';
import { stakesTotal } from '../metrics/definitions.js';
import {
  SESSION_TTL_SECONDS,
  cacheHashSet,
  sessionCacheKey,
} from '../redis/cache.js';

const supabase = createSupabaseAdmin();

const STAKE_HTTP_STATUS: Record<StakeRejectionCode, number> = {
  INVALID_AMOUNT: 400,
  ISSUE_CLOSED: 409,
  AMOUNT_MISMATCH: 400,
  AMOUNT_OUT_OF_BAND: 400,
  ALREADY_STAKED: 409,
  STAKING_DISABLED: 403,
};

export class StakeError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = 'StakeError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function throwStakeRejection(code: StakeRejectionCode, message: string): never {
  throw new StakeError(code, message, STAKE_HTTP_STATUS[code]);
}

async function countLockedStakes(issueId: string): Promise<number> {
  const { count, error } = await supabase
    .from('stakes')
    .select('id', { count: 'exact', head: true })
    .eq('issue_id', issueId)
    .eq('status', StakeStatus.LOCKED);

  if (error) throw error;
  return count ?? 0;
}

async function refreshSessionCache(userId: string): Promise<void> {
  const { count, error } = await supabase
    .from('stakes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', StakeStatus.LOCKED);

  if (error) {
    console.error('[StakeService]: Failed to count active stakes for session cache:', error);
    return;
  }

  await cacheHashSet(
    sessionCacheKey(userId),
    {
      active_stakes: String(count ?? 0),
      last_stake_at: new Date().toISOString(),
    },
    SESSION_TTL_SECONDS
  );
}

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
  const issue = await getIssueById(issueId);
  if (!issue) {
    throw new StakeError('NOT_FOUND', 'Issue not found', 404);
  }

  const { data: existingStake, error: existingError } = await supabase
    .from('stakes')
    .select('id')
    .eq('user_id', userId)
    .eq('issue_id', issueId)
    .maybeSingle();

  if (existingError) throw existingError;

  const stakingDisabled = issue.org_id
    ? await isStakingDisabled(issue.org_id)
    : false;

  const decision = evaluateStakeAttempt({
    amount,
    issueStakeAmount: issue.stake_amount,
    difficulty: issue.difficulty,
    isOpen: issue.is_open,
    alreadyStaked: Boolean(existingStake),
    stakingDisabled,
  });

  if (!decision.ok) {
    throwStakeRejection(decision.code, decision.message);
  }

  try {
    await lockCoins(userId, amount, issueId);
  } catch (err) {
    if (err instanceof Error && err.message.toLowerCase().includes('insufficient')) {
      throw new StakeError('INSUFFICIENT_BALANCE', err.message, 400);
    }
    throw err;
  }

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
    await unlockCoins(userId, amount, issueId);
    if (insertError.code === '23505') {
      throwStakeRejection(
        'ALREADY_STAKED',
        'You have already placed a stake on this issue'
      );
    }
    throw insertError;
  }

  const participants = await countLockedStakes(issueId);
  await cacheIssueMetadata({
    id: issue.id,
    stake_amount: issue.stake_amount,
    difficulty: issue.difficulty as Difficulty,
    is_open: issue.is_open,
    participant_count: participants,
  });
  await refreshSessionCache(userId);

  stakesTotal.inc({ difficulty: issue.difficulty });

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
