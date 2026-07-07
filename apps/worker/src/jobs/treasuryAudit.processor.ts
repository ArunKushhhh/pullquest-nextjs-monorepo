import { Job } from 'bullmq';
import { createSupabaseAdmin } from '@pullquest/database';
import { TREASURY_DEBT_CEILING } from '@pullquest/shared';

const supabase = createSupabaseAdmin();

export default async function processTreasuryAudit(job: Job): Promise<void> {
  const { orgId } = job.data;
  console.log(`[Worker Treasury Audit]: Auditing treasury for Org: ${orgId}`);

  const { data: treasury, error } = await supabase
    .from('treasuries')
    .select('*')
    .eq('org_id', orgId)
    .single();

  if (error || !treasury) throw error || new Error('Treasury details not found');

  // Staking is disabled if balance reaches or drops below the debt ceiling (-2000)
  const shouldDisableStaking = treasury.balance <= TREASURY_DEBT_CEILING;

  if (treasury.is_staking_disabled !== shouldDisableStaking) {
    const { error: updateError } = await supabase
      .from('treasuries')
      .update({
        is_staking_disabled: shouldDisableStaking,
        updated_at: new Date().toISOString(),
      })
      .eq('id', treasury.id);

    if (updateError) throw updateError;
    console.log(`[Worker Treasury Audit]: Staking status toggled for Org ${orgId}. Disabled: ${shouldDisableStaking}`);
  }

  await job.updateProgress(100);
}
