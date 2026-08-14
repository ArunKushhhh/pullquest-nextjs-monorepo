import { Job } from 'bullmq';
import { createSupabaseAdmin } from '@pullquest/database';
import {
  Difficulty,
  DIFFICULTY_STAKE_RANGES,
  MERGE_BONUS,
  calculateRejectionDeduction,
  calculateClosedCompensation,
  StakeStatus,
  PRStatus,
  PROutcome,
  CoinTransactionType,
} from '@pullquest/shared';

const supabase = createSupabaseAdmin();

// Helper to parse difficulty and exact stake amount from issue labels
function parseIssueLabels(labels: any[]): { difficulty: Difficulty | null; amount: number | null } {
  let difficulty: Difficulty | null = null;
  let amount: number | null = null;

  for (const label of labels) {
    const name = label.name || '';

    // Check for difficulty labels (e.g., "Easy", "Medium", "Hard", "Stake-Easy", "Stake-Medium", "Stake-Hard")
    const diffMatch = name.match(/^(Stake-)?(Easy|Medium|Hard)$/i);
    if (diffMatch) {
      difficulty = diffMatch[2].toUpperCase() as Difficulty;
    }

    // Check for exact stake amount labels (e.g., "Stake-50")
    const amountMatch = name.match(/^Stake-(\d+)$/i);
    if (amountMatch) {
      amount = parseInt(amountMatch[1], 10);
    }
  }

  return { difficulty, amount };
}

// Helpers for Coin Operations (equivalent to coin.service)
async function creditCoins(userId: string, amount: number, type: CoinTransactionType, referenceId?: string, description?: string) {
  const { data: user } = await supabase
    .from('users')
    .select('earned_coins, purchased_coins, locked_coins')
    .eq('id', userId)
    .single();

  if (!user) throw new Error(`User not found: ${userId}`);

  const newEarned = user.earned_coins + amount;

  await supabase
    .from('users')
    .update({ earned_coins: newEarned })
    .eq('id', userId);

  await supabase.from('coin_transactions').insert({
    user_id: userId,
    type,
    amount,
    earned_balance_after: newEarned,
    purchased_balance_after: user.purchased_coins,
    locked_balance_after: user.locked_coins,
    reference_id: referenceId || null,
    description: description || null,
  });
}

async function unlockCoins(userId: string, amount: number, referenceId?: string) {
  const { data: user } = await supabase
    .from('users')
    .select('earned_coins, purchased_coins, locked_coins')
    .eq('id', userId)
    .single();

  if (!user) throw new Error(`User not found: ${userId}`);

  const newEarned = user.earned_coins + amount;
  const newLocked = Math.max(0, user.locked_coins - amount);

  await supabase
    .from('users')
    .update({
      earned_coins: newEarned,
      locked_coins: newLocked,
    })
    .eq('id', userId);

  await supabase.from('coin_transactions').insert({
    user_id: userId,
    type: CoinTransactionType.STAKE_RETURN,
    amount,
    earned_balance_after: newEarned,
    purchased_balance_after: user.purchased_coins,
    locked_balance_after: newLocked,
    reference_id: referenceId || null,
    description: 'Unlocked staked coins',
  });
}

// Helpers for Treasury Operations (equivalent to treasury.service)
async function creditTreasury(orgId: string, amount: number, reason: string) {
  const { data: treasury } = await supabase
    .from('treasuries')
    .select('balance, total_credits')
    .eq('org_id', orgId)
    .single();

  if (!treasury) return;

  await supabase
    .from('treasuries')
    .update({
      balance: treasury.balance + amount,
      total_credits: treasury.total_credits + amount,
    })
    .eq('org_id', orgId);
}

async function debitTreasury(orgId: string, amount: number, reason: string) {
  const { data: treasury } = await supabase
    .from('treasuries')
    .select('balance, total_debits')
    .eq('org_id', orgId)
    .single();

  if (!treasury) return;

  await supabase
    .from('treasuries')
    .update({
      balance: treasury.balance - amount,
      total_debits: treasury.total_debits + amount,
    })
    .eq('org_id', orgId);
}

async function registerStakableIssue(payload: any): Promise<void> {
  const { difficulty, amount } = parseIssueLabels(payload.issue.labels || []);
  if (!difficulty) {
    console.log(`[Worker Webhook]: Issue #${payload.issue.number} has no valid difficulty labels. Ignoring.`);
    return;
  }

  const range = DIFFICULTY_STAKE_RANGES[difficulty];
  let finalAmount = amount;

  if (finalAmount === null) {
    finalAmount = range.min;
  } else if (finalAmount < range.min || finalAmount > range.max) {
    console.warn(`[Worker Webhook]: Stake amount ${finalAmount} is outside range for difficulty ${difficulty} (${range.min}-${range.max}). Ignoring.`);
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
      stake_amount: finalAmount,
      difficulty,
      trust_multiplier: Number(repo.trust_multiplier),
      is_open: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'github_issue_id' }
  );
  if (error) throw error;
  console.log(`[Worker Webhook]: Registered stakable issue #${payload.issue.number} with difficulty ${difficulty} and amount ${finalAmount}`);
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
        // If stake labels or difficulty labels are removed, verify if valid set remains. If not, unregister.
        const { difficulty } = parseIssueLabels(payload.issue.labels || []);
        if (!difficulty) {
          await supabase.from('issues').update({ is_open: false }).eq('github_issue_id', payload.issue.id);
          console.log(`[Worker Webhook]: Stake labels removed from Issue #${payload.issue.number}. Marked is_open = false.`);
        }
      } else if (action === 'closed') {
        await supabase.from('issues').update({ is_open: false }).eq('github_issue_id', payload.issue.id);
        console.log(`[Worker Webhook]: Closed issue #${payload.issue.number}`);
      }
    }

    // ─── 4. PULL REQUEST EVENTS ─────────────────────────────────────
    else if (event === 'pull_request') {
      const { action, pull_request, repository, sender } = payload;

      const { data: repo } = await supabase
        .from('repositories')
        .select('id')
        .eq('github_repo_id', repository.id)
        .single();

      if (!repo) return;

      if (action === 'opened') {
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('github_id', sender.id)
          .single();

        if (!user) return;

        // Parse issue references from PR body (e.g. #12, #15)
        const body = pull_request.body || '';
        const matches = [...body.matchAll(/#(\d+)/g)];

        if (matches.length > 0) {
          // Link to the first valid stakable issue found
          for (const match of matches) {
            const issueNumber = parseInt(match[1], 10);

            const { data: issue } = await supabase
              .from('issues')
              .select('id')
              .eq('repo_id', repo.id)
              .eq('github_issue_number', issueNumber)
              .single();

            if (issue) {
              await supabase.from('pull_requests').upsert(
                {
                  github_pr_id: pull_request.id,
                  github_pr_number: pull_request.number,
                  issue_id: issue.id,
                  user_id: user.id,
                  repo_id: repo.id,
                  title: pull_request.title,
                  url: pull_request.html_url,
                  status: PRStatus.OPEN,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'github_pr_id' }
              );
              console.log(`[Worker Webhook]: Registered PR #${pull_request.number} linking to issue #${issueNumber}`);
              break; // Linked successfully
            }
          }
        }
      } else if (action === 'closed') {
        const { data: pr } = await supabase
          .from('pull_requests')
          .select('*, issues(org_id, difficulty)')
          .eq('github_pr_id', pull_request.id)
          .single();

        if (!pr) return;

        const difficulty = ((pr as any).issues?.difficulty as Difficulty) || Difficulty.EASY;
        const orgId = (pr as any).issues?.org_id;

        // Load locked stake
        const { data: stake } = await supabase
          .from('stakes')
          .select('*')
          .eq('user_id', pr.user_id)
          .eq('issue_id', pr.issue_id)
          .eq('status', StakeStatus.LOCKED)
          .single();

        if (pull_request.merged) {
          // ─── PR MERGED ───
          if (stake) {
            await unlockCoins(pr.user_id, stake.amount, pr.id);
            await supabase
              .from('stakes')
              .update({ status: StakeStatus.RETURNED, resolved_at: new Date().toISOString() })
              .eq('id', stake.id);
          }

          const bonus = MERGE_BONUS[difficulty] || 10;
          await creditCoins(
            pr.user_id,
            bonus,
            CoinTransactionType.MERGE_BONUS,
            pr.id,
            `Merge bonus reward for ${difficulty} difficulty`
          );

          await supabase.from('users').update({ has_merged_pr_this_act: true }).eq('id', pr.user_id);
          await supabase.from('pull_requests').update({
            outcome: PROutcome.MERGED,
            status: PRStatus.AWAITING_EVALUATION,
            merged_at: new Date().toISOString(),
          }).eq('id', pr.id);

          console.log(`[Worker Webhook]: Resolved PR #${pull_request.number} as MERGED`);
        } else {
          // ─── PR CLOSED UNMERGED ───
          if (pr.last_review_status === 'changes_requested') {
            // ─── PR REJECTED ───
            if (stake) {
              const deduction = calculateRejectionDeduction(stake.amount);
              const refund = stake.amount - deduction;

              if (refund > 0) {
                const { data: user } = await supabase
                  .from('users')
                  .select('earned_coins, locked_coins')
                  .eq('id', pr.user_id)
                  .single();

                if (user) {
                  const newEarned = user.earned_coins + refund;
                  const newLocked = Math.max(0, user.locked_coins - stake.amount);

                  await supabase
                    .from('users')
                    .update({ earned_coins: newEarned, locked_coins: newLocked })
                    .eq('id', pr.user_id);

                  await supabase.from('coin_transactions').insert({
                    user_id: pr.user_id,
                    type: CoinTransactionType.STAKE_DEDUCTION,
                    amount: -deduction,
                    earned_balance_after: newEarned,
                    purchased_balance_after: 0,
                    locked_balance_after: newLocked,
                    reference_id: pr.id,
                    description: `PR rejected: ${deduction} coins deducted`,
                  });
                }
              }

              if (orgId && deduction > 0) {
                await creditTreasury(orgId, deduction, `Deduction from rejected PR #${pr.github_pr_number}`);
              }

              await supabase
                .from('stakes')
                .update({ status: StakeStatus.DEDUCTED, resolved_at: new Date().toISOString() })
                .eq('id', stake.id);
            }

            await supabase.from('pull_requests').update({
              outcome: PROutcome.REJECTED,
              status: PRStatus.RESOLVED,
              closed_at: new Date().toISOString(),
            }).eq('id', pr.id);

            console.log(`[Worker Webhook]: Resolved PR #${pull_request.number} as REJECTED`);
          } else {
            // ─── PR CLOSED WITHOUT MERGE ───
            if (stake) {
              await unlockCoins(pr.user_id, stake.amount, pr.id);
              await supabase
                .from('stakes')
                .update({ status: StakeStatus.REFUNDED, resolved_at: new Date().toISOString() })
                .eq('id', stake.id);

              if (orgId) {
                const compensation = calculateClosedCompensation(stake.amount);
                if (compensation > 0) {
                  await debitTreasury(orgId, compensation, `Compensation to user for closed issue #${pr.github_pr_number}`);
                  await creditCoins(
                    pr.user_id,
                    compensation,
                    CoinTransactionType.TREASURY_COMPENSATION,
                    pr.id,
                    `Received treasury compensation for closed issue`
                  );
                }
              }
            }

            await supabase.from('pull_requests').update({
              outcome: PROutcome.CLOSED_WITHOUT_MERGE,
              status: PRStatus.RESOLVED,
              closed_at: new Date().toISOString(),
            }).eq('id', pr.id);

            console.log(`[Worker Webhook]: Resolved PR #${pull_request.number} as CLOSED (unmerged)`);
          }
        }
      }
    }

    // ─── 5. PR REVIEW EVENTS ────────────────────────────────────────
    else if (event === 'pull_request_review') {
      const { action, review, pull_request } = payload;
      if (action === 'submitted') {
        const { data: pr } = await supabase
          .from('pull_requests')
          .select('id')
          .eq('github_pr_id', pull_request.id)
          .single();

        if (pr) {
          const status = review.state.toLowerCase();
          await supabase
            .from('pull_requests')
            .update({ last_review_status: status })
            .eq('id', pr.id);
          console.log(`[Worker Webhook]: Updated PR #${pull_request.number} review status to "${status}"`);
        }
      }
    }
  } catch (error) {
    console.error(`[Worker Webhook Job] Error processing event "${event}":`, error);
    throw error;
  }

  await job.updateProgress(100);
}
