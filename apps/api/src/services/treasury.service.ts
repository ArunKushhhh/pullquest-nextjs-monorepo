import { createSupabaseAdmin } from '@pullquest/database';
import {
  TREASURY_DEBT_CEILING,
  TREASURY_DEBT_WARNING,
  UserRole,
  isTreasuryStakingDisabled,
  treasuryHealthStatus,
  type TreasuryHealthStatus,
} from '@pullquest/shared';
import { treasuryAuditQueue } from '../config/queues.js';
import { treasuryBalance } from '../metrics/definitions.js';
import { getOrgById } from './org.service.js';

const supabase = createSupabaseAdmin();

export type TreasuryView = {
  orgId: string;
  orgName: string;
  balance: number;
  totalCredits: number;
  totalDebits: number;
  debtCeiling: number;
  warningThreshold: number;
  isStakingDisabled: boolean;
  health: TreasuryHealthStatus;
};

type TreasuryRow = {
  id: string;
  org_id: string;
  balance: number;
  total_credits: number;
  total_debits: number;
  is_staking_disabled: boolean;
};

export async function getTreasuryByOrgId(orgId: string) {
  const { data, error } = await supabase
    .from('treasuries')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function ensureTreasury(orgId: string): Promise<TreasuryRow> {
  const existing = await getTreasuryByOrgId(orgId);
  if (existing) return existing as TreasuryRow;

  const { data, error } = await supabase
    .from('treasuries')
    .insert({
      org_id: orgId,
      balance: 0,
      total_credits: 0,
      total_debits: 0,
      is_staking_disabled: false,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as TreasuryRow;
}

async function orgName(orgId: string): Promise<string> {
  const org = await getOrgById(orgId);
  return org?.name || orgId;
}

async function persistAndAudit(
  treasury: TreasuryRow,
  patch: {
    balance: number;
    total_credits?: number;
    total_debits?: number;
  }
): Promise<void> {
  const isStakingDisabled = isTreasuryStakingDisabled(patch.balance);
  const { error } = await supabase
    .from('treasuries')
    .update({
      ...patch,
      is_staking_disabled: isStakingDisabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', treasury.id);

  if (error) throw error;

  const name = await orgName(treasury.org_id);
  treasuryBalance.set({ org_name: name }, patch.balance);

  try {
    await treasuryAuditQueue.add(
      'check-debt-ceiling',
      { orgId: treasury.org_id },
      { removeOnComplete: true, removeOnFail: 20 }
    );
  } catch (err) {
    console.error('[Treasury]: Failed to enqueue debt-ceiling audit:', err);
  }
}

export async function creditTreasury(
  orgId: string,
  amount: number,
  reason: string
): Promise<void> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('Treasury credit amount must be a positive integer');
  }
  const treasury = await ensureTreasury(orgId);
  const newBalance = treasury.balance + amount;
  await persistAndAudit(treasury, {
    balance: newBalance,
    total_credits: treasury.total_credits + amount,
  });
  console.log(
    `[Treasury Credited]: Org: ${orgId}, Amount: +${amount}, Reason: ${reason}, New Balance: ${newBalance}`
  );
}

export async function debitTreasury(
  orgId: string,
  amount: number,
  reason: string
): Promise<void> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('Treasury debit amount must be a positive integer');
  }
  const treasury = await ensureTreasury(orgId);
  const newBalance = treasury.balance - amount;
  await persistAndAudit(treasury, {
    balance: newBalance,
    total_debits: treasury.total_debits + amount,
  });
  console.log(
    `[Treasury Debited]: Org: ${orgId}, Amount: -${amount}, Reason: ${reason}, New Balance: ${newBalance}`
  );
}

export async function isStakingDisabled(orgId: string): Promise<boolean> {
  const treasury = await getTreasuryByOrgId(orgId);
  if (!treasury) return true;
  return treasury.is_staking_disabled || isTreasuryStakingDisabled(treasury.balance);
}

export async function getTreasuryBalance(orgId: string): Promise<number> {
  const treasury = await getTreasuryByOrgId(orgId);
  if (!treasury) return 0;
  return treasury.balance;
}

export function toTreasuryView(
  orgId: string,
  orgNameValue: string,
  treasury: TreasuryRow
): TreasuryView {
  return {
    orgId,
    orgName: orgNameValue,
    balance: treasury.balance,
    totalCredits: treasury.total_credits,
    totalDebits: treasury.total_debits,
    debtCeiling: TREASURY_DEBT_CEILING,
    warningThreshold: TREASURY_DEBT_WARNING,
    isStakingDisabled:
      treasury.is_staking_disabled || isTreasuryStakingDisabled(treasury.balance),
    health: treasuryHealthStatus(treasury.balance),
  };
}

export async function getTreasuryView(orgId: string): Promise<TreasuryView | null> {
  const org = await getOrgById(orgId);
  if (!org) return null;
  const treasury = await ensureTreasury(orgId);
  return toTreasuryView(orgId, org.name, treasury);
}

export async function canViewTreasury(
  userId: string,
  role: string,
  orgId: string
): Promise<boolean> {
  if (role === UserRole.PLATFORM_ADMIN || role === UserRole.ORG_ADMIN) {
    return true;
  }

  const org = await getOrgById(orgId);
  if (!org) return false;

  if (org.installation_id) {
    const { data: inst, error } = await supabase
      .from('installations')
      .select('installed_by')
      .eq('id', org.installation_id)
      .maybeSingle();
    if (error) throw error;
    if (inst?.installed_by === userId) return true;
  }

  const { data: byAccount, error: accountErr } = await supabase
    .from('installations')
    .select('id')
    .eq('installed_by', userId)
    .eq('account_id', org.github_org_id)
    .limit(1);

  if (accountErr) throw accountErr;
  return (byAccount?.length ?? 0) > 0;
}
