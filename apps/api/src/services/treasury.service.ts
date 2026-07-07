import { createSupabaseAdmin } from '@pullquest/database';
import { TREASURY_DEBT_CEILING } from '@pullquest/shared';

const supabase = createSupabaseAdmin();

export async function getTreasuryByOrgId(orgId: string) {
  const { data, error } = await supabase
    .from('treasuries')
    .select('*')
    .eq('org_id', orgId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function creditTreasury(
  orgId: string,
  amount: number,
  reason: string
): Promise<void> {
  const treasury = await getTreasuryByOrgId(orgId);
  if (!treasury) throw new Error('Treasury not found');

  const newBalance = treasury.balance + amount;
  const newCredits = treasury.total_credits + amount;

  // Staking is enabled if balance rises above the debt ceiling
  const isStakingDisabled = newBalance <= TREASURY_DEBT_CEILING;

  const { error } = await supabase
    .from('treasuries')
    .update({
      balance: newBalance,
      total_credits: newCredits,
      is_staking_disabled: isStakingDisabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', treasury.id);

  if (error) throw error;
  console.log(`[Treasury Credited]: Org: ${orgId}, Amount: +${amount}, Reason: ${reason}, New Balance: ${newBalance}`);
}

export async function debitTreasury(
  orgId: string,
  amount: number,
  reason: string
): Promise<void> {
  const treasury = await getTreasuryByOrgId(orgId);
  if (!treasury) throw new Error('Treasury not found');

  const newBalance = treasury.balance - amount;
  const newDebits = treasury.total_debits + amount;

  // Staking is disabled if balance drops below or equal to the debt ceiling
  const isStakingDisabled = newBalance <= TREASURY_DEBT_CEILING;

  const { error } = await supabase
    .from('treasuries')
    .update({
      balance: newBalance,
      total_debits: newDebits,
      is_staking_disabled: isStakingDisabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', treasury.id);

  if (error) throw error;
  console.log(`[Treasury Debited]: Org: ${orgId}, Amount: -${amount}, Reason: ${reason}, New Balance: ${newBalance}`);
}

export async function isStakingDisabled(orgId: string): Promise<boolean> {
  const treasury = await getTreasuryByOrgId(orgId);
  if (!treasury) return true;
  return treasury.is_staking_disabled;
}

export async function getTreasuryBalance(orgId: string): Promise<number> {
  const treasury = await getTreasuryByOrgId(orgId);
  if (!treasury) return 0;
  return treasury.balance;
}
