import { createSupabaseAdmin } from '@pullquest/database';
import { User, CoinTransactionType } from '@pullquest/shared';

const supabase = createSupabaseAdmin();

export async function getUserBalance(userId: string) {
  const { data: user, error } = await supabase
    .from('users')
    .select('earned_coins, purchased_coins, locked_coins')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return {
    earned: user.earned_coins,
    purchased: user.purchased_coins,
    locked: user.locked_coins,
    total: user.earned_coins + user.purchased_coins + user.locked_coins,
  };
}

export async function creditCoins(
  userId: string,
  amount: number,
  type: CoinTransactionType,
  referenceId: string | null = null,
  description: string | null = null
): Promise<User> {
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (fetchError || !user) throw fetchError || new Error('User not found');

  let newEarned = user.earned_coins;
  let newPurchased = user.purchased_coins;

  if (type === CoinTransactionType.PURCHASE) {
    newPurchased += amount;
  } else {
    newEarned += amount;
  }

  const { data: updatedUser, error: updateError } = await supabase
    .from('users')
    .update({ earned_coins: newEarned, purchased_coins: newPurchased })
    .eq('id', userId)
    .select('*')
    .single();

  if (updateError) throw updateError;

  const { error: txError } = await supabase.from('coin_transactions').insert({
    user_id: userId,
    type,
    amount,
    earned_balance_after: newEarned,
    purchased_balance_after: newPurchased,
    locked_balance_after: user.locked_coins,
    reference_id: referenceId,
    description,
  });

  if (txError) throw txError;

  return updatedUser as User;
}

export async function deductCoins(
  userId: string,
  amount: number,
  type: CoinTransactionType,
  referenceId: string | null = null,
  description: string | null = null
): Promise<User> {
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (fetchError || !user) throw fetchError || new Error('User not found');

  const totalAvailable = user.earned_coins + user.purchased_coins;
  if (totalAvailable < amount) {
    throw new Error('Insufficient coin balance');
  }

  let newEarned = user.earned_coins;
  let newPurchased = user.purchased_coins;

  if (newEarned >= amount) {
    newEarned -= amount;
  } else {
    const remainder = amount - newEarned;
    newEarned = 0;
    newPurchased -= remainder;
  }

  const { data: updatedUser, error: updateError } = await supabase
    .from('users')
    .update({ earned_coins: newEarned, purchased_coins: newPurchased })
    .eq('id', userId)
    .select('*')
    .single();

  if (updateError) throw updateError;

  const { error: txError } = await supabase.from('coin_transactions').insert({
    user_id: userId,
    type,
    amount: -amount,
    earned_balance_after: newEarned,
    purchased_balance_after: newPurchased,
    locked_balance_after: user.locked_coins,
    reference_id: referenceId,
    description,
  });

  if (txError) throw txError;

  return updatedUser as User;
}

export async function lockCoins(
  userId: string,
  amount: number,
  referenceId: string | null = null
): Promise<User> {
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (fetchError || !user) throw fetchError || new Error('User not found');

  const totalAvailable = user.earned_coins + user.purchased_coins;
  if (totalAvailable < amount) {
    throw new Error('Insufficient coin balance to lock');
  }

  let newEarned = user.earned_coins;
  let newPurchased = user.purchased_coins;
  const newLocked = user.locked_coins + amount;

  if (newEarned >= amount) {
    newEarned -= amount;
  } else {
    const remainder = amount - newEarned;
    newEarned = 0;
    newPurchased -= remainder;
  }

  const { data: updatedUser, error: updateError } = await supabase
    .from('users')
    .update({
      earned_coins: newEarned,
      purchased_coins: newPurchased,
      locked_coins: newLocked,
    })
    .eq('id', userId)
    .select('*')
    .single();

  if (updateError) throw updateError;

  const { error: txError } = await supabase.from('coin_transactions').insert({
    user_id: userId,
    type: CoinTransactionType.STAKE_LOCK,
    amount: -amount,
    earned_balance_after: newEarned,
    purchased_balance_after: newPurchased,
    locked_balance_after: newLocked,
    reference_id: referenceId,
    description: 'Coins locked for staking on issue',
  });

  if (txError) throw txError;

  return updatedUser as User;
}

export async function unlockCoins(
  userId: string,
  amount: number,
  referenceId: string | null = null
): Promise<User> {
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (fetchError || !user) throw fetchError || new Error('User not found');

  if (user.locked_coins < amount) {
    throw new Error('Insufficient locked coins to unlock');
  }

  const newEarned = user.earned_coins + amount;
  const newLocked = user.locked_coins - amount;

  const { data: updatedUser, error: updateError } = await supabase
    .from('users')
    .update({
      earned_coins: newEarned,
      locked_coins: newLocked,
    })
    .eq('id', userId)
    .select('*')
    .single();

  if (updateError) throw updateError;

  const { error: txError } = await supabase.from('coin_transactions').insert({
    user_id: userId,
    type: CoinTransactionType.STAKE_RETURN,
    amount,
    earned_balance_after: newEarned,
    purchased_balance_after: user.purchased_coins,
    locked_balance_after: newLocked,
    reference_id: referenceId,
    description: 'Coins unlocked from resolved stake',
  });

  if (txError) throw txError;

  return updatedUser as User;
}
export async function purchaseCoins(
  userId: string,
  amount: number,
  referenceId: string
): Promise<User> {
  return await creditCoins(
    userId,
    amount,
    CoinTransactionType.PURCHASE,
    referenceId,
    'Purchased coin bundle'
  );
}
