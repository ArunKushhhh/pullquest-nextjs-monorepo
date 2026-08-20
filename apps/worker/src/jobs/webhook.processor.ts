import { Job } from 'bullmq';
import { createSupabaseAdmin } from '@pullquest/database';
import {
  DIFFICULTY_STAKE_RANGES,
  parseStakeLabels,
} from '@pullquest/shared';

const supabase = createSupabaseAdmin();

async function registerStakableIssue(payload: any): Promise<void> {
  const labelNames = (payload.issue.labels || []).map((label: { name?: string }) => label.name || '');
  const { difficulty, amount } = parseStakeLabels(labelNames);
  // Stake-X is mandatory — do not default to the band minimum (PRD §2.2)
  if (!difficulty || amount === null) {
    console.log(`[Worker Webhook]: Issue #${payload.issue.number} missing difficulty or Stake-X label. Ignoring.`);
    return;
  }

  const range = DIFFICULTY_STAKE_RANGES[difficulty];
  if (amount < range.min || amount > range.max) {
    console.warn(`[Worker Webhook]: Stake amount ${amount} is outside range for difficulty ${difficulty} (${range.min}-${range.max}). Ignoring.`);
    return;
  }

  const { data: repo } = await supabase
    .from('repositories')
    .select('id, org_id, trust_multiplier')
    .eq('github_repo_id', payload.repository.id)
    .single();

  if (!repo) {
    console.warn(`[Worker Webhook]: Repo github_repo_id=${payload.repository.id} not in repositories table. Ignoring issue #${payload.issue.number}.`);
    return;
  }

  const { error } = await supabase.from('issues').upsert(
    {
      github_issue_id: payload.issue.id,
      github_issue_number: payload.issue.number,
      repo_id: repo.id,
      org_id: repo.org_id,
      title: payload.issue.title,
      url: payload.issue.html_url,
      stake_amount: amount,
      difficulty,
      trust_multiplier: Number(repo.trust_multiplier),
      is_open: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'github_issue_id' }
  );
  if (error) throw error;
  console.log(`[Worker Webhook]: Registered stakable issue #${payload.issue.number} with difficulty ${difficulty} and amount ${amount}`);
}

export default async function processWebhook(job: Job): Promise<void> {
  const { event, payload } = job.data;
  console.log(`[Worker Webhook Job]: Processing event "${event}" (action: ${payload?.action})`);

  try {
    // ─── 1. INSTALLATION EVENTS ─────────────────────────────────────
    if (event === 'installation') {
      const installationId = payload.installation.id;
      const accountLogin = payload.installation.account.login;
      const accountType = payload.installation.account.type;
      const accountId = payload.installation.account.id;
      const permissions = payload.installation.permissions;
      const installerGithubId = payload.sender.id;

      if (payload.action === 'created') {
        // Find installer user
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('github_id', installerGithubId)
          .single();

        const userId = user ? user.id : '00000000-0000-0000-0000-000000000000';

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

        if (inst && accountType === 'Organization') {
          // Upsert organization
          const { data: org } = await supabase
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

          if (org) {
            // Upsert treasury
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
        }

        // installation.created includes the granted repo list (capped at 50 by GitHub)
        if (inst && Array.isArray(payload.repositories)) {
          let orgId: string | null = null;
          if (accountType === 'Organization') {
            const { data: org } = await supabase
              .from('organizations')
              .select('id')
              .eq('github_org_id', accountId)
              .single();
            if (org) orgId = org.id;
          }

          for (const repo of payload.repositories) {
            const { error: repoErr } = await supabase.from('repositories').upsert(
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
            if (repoErr) throw repoErr;
          }
        }
      } else if (payload.action === 'deleted') {
        const { data: inst } = await supabase
          .from('installations')
          .select('id')
          .eq('installation_id', installationId)
          .single();

        if (inst) {
          await supabase.from('organizations').update({ installation_id: null }).eq('github_org_id', accountId);
          await supabase.from('repositories').delete().eq('installation_id', inst.id);
          await supabase.from('installations').delete().eq('id', inst.id);
        }
      }
    }

    // ─── 2. REPOSITORY EVENTS ───────────────────────────────────────
    else if (event === 'installation_repositories') {
      const installationId = payload.installation.id;

      const { data: inst } = await supabase
        .from('installations')
        .select('id, account_type, account_id')
        .eq('installation_id', installationId)
        .single();

      if (inst) {
        let orgId: string | null = null;
        if (inst.account_type === 'Organization') {
          const { data: org } = await supabase
            .from('organizations')
            .select('id')
            .eq('github_org_id', inst.account_id)
            .single();
          if (org) orgId = org.id;
        }

        if (payload.action === 'added') {
          for (const repo of payload.repositories_added || []) {
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
        } else if (payload.action === 'removed') {
          const repoIds = (payload.repositories_removed || []).map((r: any) => r.id);
          if (repoIds.length > 0) {
            await supabase.from('repositories').delete().in('github_repo_id', repoIds);
          }
        }
      }
    }

    // ─── 3. ISSUE EVENTS ────────────────────────────────────────────
    else if (event === 'issues') {
      const action = payload.action;

      if (action === 'labeled' || action === 'opened' || action === 'reopened') {
        await registerStakableIssue(payload);
      } else if (action === 'unlabeled') {
        const labelNames = (payload.issue.labels || []).map((label: { name?: string }) => label.name || '');
        const { difficulty, amount } = parseStakeLabels(labelNames);
        if (!difficulty || amount === null) {
          await supabase.from('issues').update({ is_open: false }).eq('github_issue_id', payload.issue.id);
          console.log(`[Worker Webhook]: Stake labels removed from Issue #${payload.issue.number}. Marked is_open = false.`);
        }
      } else if (action === 'closed') {
        await supabase.from('issues').update({ is_open: false }).eq('github_issue_id', payload.issue.id);
        console.log(`[Worker Webhook]: Closed issue #${payload.issue.number}`);
      }
    }

    // PR opened/closed/reviewed is handled in API PRService (PRD §2.3). Ignore stale queued jobs.
    else if (event === 'pull_request' || event === 'pull_request_review') {
      console.log(
        `[Worker Webhook]: Skipping "${event}" — PR lifecycle is handled by the API PRService`
      );
    }
  } catch (error) {
    console.error(`[Worker Webhook Job] Error processing event "${event}":`, error);
    throw error;
  }

  await job.updateProgress(100);
}
