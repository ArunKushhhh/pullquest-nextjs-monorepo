import { createSupabaseAdmin } from '@pullquest/database';
import {
  User,
  CoinTransactionType,
  COIN_BUNDLES,
  type CoinBundleId,
  coinBundlePurchaseDescription,
  inferCoinBundleId,
  isCoinBundleId,
} from '@pullquest/shared';
import { coinsMintedTotal } from '../metrics/definitions.js';
import { getCurrentAct } from './act.service.js';

const supabase = createSupabaseAdmin();

export class CoinError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = 'CoinError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const MINT_TYPES: CoinTransactionType[] = [
  CoinTransactionType.SIGNUP_BONUS,
  CoinTransactionType.MONTHLY_MINT,
  CoinTransactionType.MERGE_BONUS,
];

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

  if (MINT_TYPES.includes(type)) {
    coinsMintedTotal.inc({ type }, amount);
  }

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

export async function listPurchasedBundleIdsThisAct(userId: string): Promise<CoinBundleId[]> {
  const act = await getCurrentAct();
  if (!act) return [];

  const { data, error } = await supabase
    .from('coin_transactions')
    .select('amount, description')
    .eq('user_id', userId)
    .eq('type', CoinTransactionType.PURCHASE)
    .gte('created_at', act.start_date);

  if (error) throw error;

  const ids = new Set<CoinBundleId>();
  for (const tx of data ?? []) {
    const bundleId = inferCoinBundleId({
      amount: tx.amount,
      description: tx.description,
    });
    if (bundleId) ids.add(bundleId);
  }
  return [...ids];
}

export async function assertBundlePurchasableThisAct(
  userId: string,
  bundleId: CoinBundleId
): Promise<void> {
  const purchased = await listPurchasedBundleIdsThisAct(userId);
  if (purchased.includes(bundleId)) {
    throw new CoinError(
      'BUNDLE_ALREADY_PURCHASED',
      'This coin bundle can only be purchased once per Act',
      409
    );
  }
}

export async function listCoinBundlesForUser(userId: string) {
  const purchased = new Set(await listPurchasedBundleIdsThisAct(userId));
  return Object.values(COIN_BUNDLES).map((bundle) => ({
    id: bundle.id,
    name: bundle.name,
    amount: bundle.amount,
    priceCents: bundle.priceCents,
    description: bundle.description,
    purchasedThisAct: purchased.has(bundle.id),
  }));
}

export async function purchaseCoins(
  userId: string,
  amount: number,
  referenceId: string,
  bundleId?: string
): Promise<User> {
  const { data: existing, error: existingErr } = await supabase
    .from('coin_transactions')
    .select('user_id')
    .eq('reference_id', referenceId)
    .eq('type', CoinTransactionType.PURCHASE)
    .maybeSingle();

  if (existingErr) throw existingErr;
  if (existing) {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (error || !user) throw error || new Error('User not found');
    return user as User;
  }

  let catalogId: CoinBundleId | undefined;
  if (bundleId) {
    if (!isCoinBundleId(bundleId)) {
      throw new CoinError('INVALID_BUNDLE', 'Unknown coin bundle', 400);
    }
    catalogId = bundleId;
    await assertBundlePurchasableThisAct(userId, catalogId);
  }

  return creditCoins(
    userId,
    amount,
    CoinTransactionType.PURCHASE,
    referenceId,
    catalogId
      ? coinBundlePurchaseDescription(catalogId)
      : 'Purchased coin bundle'
  );
}
