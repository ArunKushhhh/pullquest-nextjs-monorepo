import { Job } from 'bullmq';
import { createSupabaseAdmin } from '@pullquest/database';
import {
  calculateActResetXP,
  getActResetCoinBalance,
  getTierForXP,
  CoinTransactionType,
  TierName,
} from '@pullquest/shared';
import { connection as redis } from '../config/redis.js';

const supabase = createSupabaseAdmin();

export default async function processActReset(job: Job): Promise<void> {
  console.log('[Worker Act Reset]: Starting seasonal act reset...');

  // 1. Fetch current active Act
  const { data: currentAct, error: actErr } = await supabase
    .from('acts')
    .select('*')
    .eq('status', 'ACTIVE')
    .order('act_number', { ascending: false })
    .limit(1)
    .single();

  if (actErr || !currentAct) {
    throw actErr || new Error('No active Act found to reset.');
  }

  // 2. Fetch all users
  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('*');

  if (usersErr) throw usersErr;

  console.log(`[Worker Act Reset]: Found ${users?.length || 0} users to process.`);

  // 3. Process each user: compression & coin reset
  if (users) {
    for (const user of users) {
      try {
        const tier = user.current_tier as Exclude<TierName, TierName.UNRANKED>;
        const newXP = calculateActResetXP(user.global_xp, tier);
        const newTier = getTierForXP(newXP);
        const newEarnedCoins = getActResetCoinBalance(newTier as Exclude<TierName, TierName.UNRANKED>);

        // Update user
        await supabase
          .from('users')
          .update({
            global_xp: newXP,
            current_tier: newTier,
            earned_coins: newEarnedCoins,
            has_merged_pr_this_act: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        // Log reset transaction
        await supabase.from('coin_transactions').insert({
          user_id: user.id,
          type: CoinTransactionType.ACT_RESET,
          amount: newEarnedCoins - user.earned_coins,
          earned_balance_after: newEarnedCoins,
          purchased_balance_after: user.purchased_coins,
          locked_balance_after: user.locked_coins,
          description: `Seasonal reset for Act #${currentAct.act_number}`,
        });
      } catch (err) {
        console.error(`[Worker Act Reset]: Failed to reset user ${user.id}:`, err);
      }
    }
  }

  // 4. Archive global leaderboard from Redis
  const globalKey = `leaderboard:global:${currentAct.id}`;
  try {
    const rawGlobal = await redis.zrevrange(globalKey, 0, -1, 'WITHSCORES');
    const globalEntries: any[] = [];
    
    for (let i = 0; i < rawGlobal.length; i += 2) {
      const uId = rawGlobal[i];
      const score = Math.floor(parseFloat(rawGlobal[i + 1]));

      // Fetch user profile info
      const { data: userProfile } = await supabase
        .from('users')
        .select('github_username, avatar_url, current_tier')
        .eq('id', uId)
        .single();

      globalEntries.push({
        rank: (i / 2) + 1,
        user_id: uId,
        github_username: userProfile?.github_username || 'unknown',
        avatar_url: userProfile?.avatar_url || null,
        xp: score,
        tier: userProfile?.current_tier || 'UNRANKED',
      });
    }

    if (globalEntries.length > 0) {
      await supabase.from('leaderboard_archives').insert({
        act_id: currentAct.id,
        type: 'global',
        org_id: null,
        entries: globalEntries,
      });
    }
    
    // Clear global leaderboard in Redis
    await redis.del(globalKey);
  } catch (err) {
    console.error('[Worker Act Reset]: Failed to archive global leaderboard:', err);
  }

  // 5. Fetch and Archive Org-specific leaderboards
  // Find all org IDs that have keys in Redis
  try {
    const keys = await redis.keys('leaderboard:org:*:*');
    for (const key of keys) {
      // Key format: leaderboard:org:<org_id>:<act_id>
      const parts = key.split(':');
      const orgId = parts[2];
      const keyActId = parts[3];

      if (keyActId === currentAct.id) {
        const rawOrg = await redis.zrevrange(key, 0, -1, 'WITHSCORES');
        const orgEntries: any[] = [];

        for (let i = 0; i < rawOrg.length; i += 2) {
          const uId = rawOrg[i];
          const score = Math.floor(parseFloat(rawOrg[i + 1]));

          const { data: userProfile } = await supabase
            .from('users')
            .select('github_username, avatar_url, current_tier')
            .eq('id', uId)
            .single();

          orgEntries.push({
            rank: (i / 2) + 1,
            user_id: uId,
            github_username: userProfile?.github_username || 'unknown',
            avatar_url: userProfile?.avatar_url || null,
            xp: score,
            tier: userProfile?.current_tier || 'UNRANKED',
          });
        }

        if (orgEntries.length > 0) {
          await supabase.from('leaderboard_archives').insert({
            act_id: currentAct.id,
            type: 'org',
            org_id: orgId,
            entries: orgEntries,
          });
        }

        await redis.del(key);
      }
    }
  } catch (err) {
    console.error('[Worker Act Reset]: Failed to archive org leaderboards:', err);
  }

  // 6. Close the current Act
  await supabase
    .from('acts')
    .update({ status: 'ENDED', updated_at: new Date().toISOString() })
    .eq('id', currentAct.id);

  // 7. Initialize new Act
  const nextActNumber = currentAct.act_number + 1;
  const newStartDate = new Date();
  const newEndDate = new Date();
  newEndDate.setDate(newStartDate.getDate() + 45); // next 45 days

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

  console.log(`[Worker Act Reset]: Successfully ended Act #${currentAct.act_number} and initialized Act #${newAct.act_number}.`);
  await job.updateProgress(100);
}
