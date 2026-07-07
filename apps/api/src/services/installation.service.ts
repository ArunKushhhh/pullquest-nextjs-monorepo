import { createSupabaseAdmin } from '@pullquest/database';

const supabase = createSupabaseAdmin();

export async function getInstallationStatus(userId: string) {
  const { data, error } = await supabase
    .from('installations')
    .select('*')
    .eq('installed_by', userId);

  if (error) throw error;
  return data;
}

export async function handleInstallationCreated(payload: any) {
  const installationId = payload.installation.id;
  const accountLogin = payload.installation.account.login;
  const accountType = payload.installation.account.type;
  const accountId = payload.installation.account.id;
  const permissions = payload.installation.permissions;
  const installerGithubId = payload.sender.id;

  // Look up user who authorized the installation
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('github_id', installerGithubId)
    .single();

  const userId = user ? user.id : '00000000-0000-0000-0000-000000000000'; // Default system uuid if user not found

  // Upsert installation
  const { data: inst, error: instErr } = await supabase
    .from('installations')
    .upsert(
      {
        installation_id: installationId,
        account_type: accountType,
        account_id: accountId,
        account_login: accountLogin,
        permissions,
        installed_by: userId,
        installed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'installation_id' }
    )
    .select('*')
    .single();

  if (instErr) throw instErr;

  let orgId: string | null = null;

  // Handle Organization link
  if (accountType === 'Organization') {
    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .upsert(
        {
          github_org_id: accountId,
          name: accountLogin,
          avatar_url: payload.installation.account.avatar_url || null,
          installation_id: inst.id,
          credibility_score: 100,
          subscription_status: 'none',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'github_org_id' }
      )
      .select('*')
      .single();

    if (orgErr) throw orgErr;
    orgId = org.id;

    // Create treasury for the organization if not present
    const { data: existingTreasury } = await supabase
      .from('treasuries')
      .select('id')
      .eq('org_id', org.id)
      .single();

    if (!existingTreasury) {
      await supabase.from('treasuries').insert({
        org_id: org.id,
        balance: 0,
        total_credits: 0,
        total_debits: 0,
        is_staking_disabled: false,
      });
    }
  }

  // Handle repository link
  if (payload.repositories) {
    for (const repo of payload.repositories) {
      await supabase.from('repositories').upsert(
        {
          github_repo_id: repo.id,
          installation_id: inst.id,
          org_id: orgId,
          name: repo.name,
          full_name: repo.full_name,
          star_count: 0,
          member_count: 0,
          trust_multiplier: 0.5,
          is_private: repo.private || false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'github_repo_id' }
      );
    }
  }

  return inst;
}

export async function handleInstallationDeleted(payload: any) {
  const installationId = payload.installation.id;

  const { data: inst } = await supabase
    .from('installations')
    .select('id, account_type, account_id')
    .eq('installation_id', installationId)
    .single();

  if (!inst) return;

  if (inst.account_type === 'Organization') {
    await supabase
      .from('organizations')
      .update({ installation_id: null })
      .eq('github_org_id', inst.account_id);
  }

  // Delete repo files linked to this installation
  await supabase
    .from('repositories')
    .delete()
    .eq('installation_id', inst.id);

  // Delete installation
  await supabase
    .from('installations')
    .delete()
    .eq('id', inst.id);
}
