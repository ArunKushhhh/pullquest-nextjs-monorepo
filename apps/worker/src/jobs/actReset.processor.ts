import { Job } from 'bullmq';
import { createSupabaseAdmin } from '@pullquest/database';
import {
  ACT_DURATION_DAYS,
  calculateActResetXP,
  CoinTransactionType,
  effectiveTierForActReset,
  getActResetCoinBalance,
  getTierForXP,
  StakeStatus,
  TierName,
} from '@pullquest/shared';
import { connection as redis } from '../config/redis.js';
import { Sentry } from '../config/sentry.js';

const supabase = createSupabaseAdmin();

type ArchiveEntry = {
  rank: number;
  user_id: string;
  github_username: string;
  avatar_url: string | null;
  xp: number;
  tier: string;
};

type ActResetJobData = {
  force?: boolean;
};

async function archiveSortedSet(
  key: string,
  type: 'global' | 'org',
  actId: string,
  orgId: string | null
): Promise<void> {
  const raw = await redis.zrevrange(key, 0, -1, 'WITHSCORES');
  const entries: ArchiveEntry[] = [];

  for (let i = 0; i < raw.length; i += 2) {
    const userId = raw[i];
    const score = Math.floor(parseFloat(raw[i + 1]));
    const { data: profile } = await supabase
      .from('users')
      .select('github_username, avatar_url, current_tier')
      .eq('id', userId)
      .single();

    entries.push({
      rank: i / 2 + 1,
      user_id: userId,
      github_username: profile?.github_username || 'unknown',
      avatar_url: profile?.avatar_url || null,
      xp: score,
      tier: profile?.current_tier || 'UNRANKED',
    });
  }

  if (entries.length > 0) {
    const { error } = await supabase.from('leaderboard_archives').insert({
      act_id: actId,
      type,
      org_id: orgId,
      entries,
    });
    if (error) throw error;
  }

  await redis.del(key);
}

export default async function processActReset(job: Job<ActResetJobData>): Promise<void> {
  const force = Boolean(job.data?.force);
  const started = Date.now();
  console.log(`[Worker Act Reset]: Starting seasonal act reset (force=${force})...`);

  const { data: currentAct, error: actErr } = await supabase
    .from('acts')
    .select('*')
    .eq('status', 'ACTIVE')
    .order('act_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (actErr) throw actErr;
  if (!currentAct) {
    console.log('[Worker Act Reset]: No active Act; skipping.');
    await job.updateProgress(100);
    return;
  }

  if (!force && new Date(currentAct.end_date).getTime() > Date.now()) {
    console.log(
      `[Worker Act Reset]: Act #${currentAct.act_number} still has time remaining; skipping.`
    );
    await job.updateProgress(100);
    return;
  }

  const { data: lockedStakes, error: stakeErr } = await supabase
    .from('stakes')
    .select('id')
    .eq('status', StakeStatus.LOCKED)
    .limit(1);

  if (stakeErr) throw stakeErr;
  if (lockedStakes && lockedStakes.length > 0) {
    throw new Error('Open LOCKED stakes remain; cannot reset Act');
  }

  await archiveSortedSet(
    `leaderboard:global:${currentAct.id}`,
    'global',
    currentAct.id,
    null
  );

  const orgKeys = await redis.keys('leaderboard:org:*:*');
  for (const key of orgKeys) {
    const parts = key.split(':');
    const orgId = parts[2];
    const keyActId = parts[3];
    if (keyActId !== currentAct.id) continue;
    await archiveSortedSet(key, 'org', currentAct.id, orgId);
  }

  const { data: users, error: usersErr } = await supabase.from('users').select('*');
  if (usersErr) throw usersErr;

  let processed = 0;
  for (const user of users ?? []) {
    const rankedTier = effectiveTierForActReset(
      user.current_tier as TierName,
      user.global_xp
    );
    const newXP = calculateActResetXP(user.global_xp, rankedTier);
    const compressedTier = getTierForXP(newXP) as Exclude<TierName, TierName.UNRANKED>;
    const newEarnedCoins = getActResetCoinBalance(compressedTier);

    const { error: userErr } = await supabase
      .from('users')
      .update({
        global_xp: newXP,
        current_tier: TierName.UNRANKED,
        earned_coins: newEarnedCoins,
        has_merged_pr_this_act: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (userErr) {
      console.error(`[Worker Act Reset]: Failed to reset user ${user.id}:`, userErr);
      continue;
    }

    const { error: txErr } = await supabase.from('coin_transactions').insert({
      user_id: user.id,
      type: CoinTransactionType.ACT_RESET,
      amount: newEarnedCoins - user.earned_coins,
      earned_balance_after: newEarnedCoins,
      purchased_balance_after: user.purchased_coins,
      locked_balance_after: user.locked_coins,
      reference_id: currentAct.id,
      description: `Seasonal reset for Act #${currentAct.act_number}`,
    });
    if (txErr) {
      console.error(`[Worker Act Reset]: Coin log failed for ${user.id}:`, txErr);
    }
    processed += 1;
  }

  const { error: endErr } = await supabase
    .from('acts')
    .update({ status: 'ENDED', updated_at: new Date().toISOString() })
    .eq('id', currentAct.id);
  if (endErr) throw endErr;

  const nextActNumber = currentAct.act_number + 1;
  const newStartDate = new Date();
  const newEndDate = new Date();
  newEndDate.setDate(newStartDate.getDate() + ACT_DURATION_DAYS);

  const { data: newAct, error: newActErr } = await supabase
    .from('acts')
    .insert({
      act_number: nextActNumber,
      status: 'ACTIVE',
      start_date: newStartDate.toISOString(),
      end_date: newEndDate.toISOString(),
    })
    .select('*')
    .single();

  if (newActErr) throw newActErr;

  if ((users ?? []).length > 0) {
    const { error: actIdErr } = await supabase
      .from('users')
      .update({ current_act_id: newAct.id, updated_at: new Date().toISOString() })
      .in(
        'id',
        users.map((u) => u.id)
      );
    if (actIdErr) {
      console.error('[Worker Act Reset]: Failed to point users at new Act:', actIdErr);
    }
  }

  const durationSeconds = (Date.now() - started) / 1000;
  Sentry.addBreadcrumb({
    category: 'act',
    message: `Act ${currentAct.act_number} reset completed`,
    level: 'info',
    data: {
      previousActId: currentAct.id,
      newActId: newAct.id,
      usersProcessed: processed,
      durationSeconds,
    },
  });

  console.log(
    `[Worker Act Reset]: Ended Act #${currentAct.act_number}, started Act #${newAct.act_number}; processed ${processed} users in ${durationSeconds.toFixed(2)}s.`
  );
  await job.updateProgress(100);
}
