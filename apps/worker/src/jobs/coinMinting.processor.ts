import { Job } from 'bullmq';
import { createSupabaseAdmin } from '@pullquest/database';
import { CoinTransactionType, COIN_AMOUNTS } from '@pullquest/shared';

const supabase = createSupabaseAdmin();

export default async function processCoinMinting(job: Job): Promise<void> {
  console.log('[Worker Coin Minting]: Starting monthly coin distribution...');

  // Fetch all users
  const { data: users, error } = await supabase
    .from('users')
    .select('id, earned_coins, purchased_coins, locked_coins');

  if (error) throw error;
  if (!users || users.length === 0) {
    console.log('[Worker Coin Minting]: No users found to credit.');
    return;
  }

  const amount = COIN_AMOUNTS.MONTHLY;

  for (const user of users) {
    try {
      const newEarned = user.earned_coins + amount;

      // Update user earned coins
      await supabase
        .from('users')
        .update({ earned_coins: newEarned })
        .eq('id', user.id);

      // Log transaction
      await supabase.from('coin_transactions').insert({
        user_id: user.id,
        type: CoinTransactionType.MONTHLY_MINT,
        amount,
        earned_balance_after: newEarned,
        purchased_balance_after: user.purchased_coins,
        locked_balance_after: user.locked_coins,
        description: 'Monthly active user coin mint distribution',
      });
    } catch (err) {
      console.error(`[Worker Coin Minting]: Failed to credit user ${user.id}:`, err);
    }
  }

  console.log(`[Worker Coin Minting]: Successfully distributed monthly coins to ${users.length} users.`);
  await job.updateProgress(100);
}
