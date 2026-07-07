import crypto from 'crypto';
import { createSupabaseAdmin } from '@pullquest/database';
import { Difficulty, DIFFICULTY_STAKE_RANGES } from '@pullquest/shared';
import { handleInstallationCreated, handleInstallationDeleted } from './installation.service.js';
import { registerIssue, closeIssue } from './issue.service.js';
import { registerPR, handlePRMerged, handlePRClosed } from './pr.service.js';

const supabase = createSupabaseAdmin();

export function verifyGitHubSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch {
    return false;
  }
}

export async function handleGitHubEvent(event: string, payload: any): Promise<void> {
  console.log(`[GitHub Webhook]: Received event ${event}`);

  if (event === 'installation') {
    if (payload.action === 'created') {
      await handleInstallationCreated(payload);
    } else if (payload.action === 'deleted') {
      await handleInstallationDeleted(payload);
    }
  }

  else if (event === 'installation_repositories') {
    if (payload.action === 'added') {
      await handleInstallationCreated(payload);
    } else if (payload.action === 'removed') {
      // Repositories removed
      const repoIds = (payload.repositories_removed || []).map((r: any) => r.id);
      if (repoIds.length > 0) {
        await supabase
          .from('repositories')
          .delete()
          .in('github_repo_id', repoIds);
      }
    }
  }

  else if (event === 'issues') {
    if (payload.action === 'labeled') {
      const labelName = payload.label?.name || '';
      const match = labelName.match(/^Stake-(Easy|Medium|Hard)$/i);

      if (match) {
        const difficulty = match[1].toUpperCase() as Difficulty;
        const stakeAmount = DIFFICULTY_STAKE_RANGES[difficulty].min;

        // Fetch repository from DB
        const { data: repo } = await supabase
          .from('repositories')
          .select('id, org_id, trust_multiplier')
          .eq('github_repo_id', payload.repository.id)
          .single();

        if (repo) {
          await registerIssue({
            github_issue_id: payload.issue.id,
            github_issue_number: payload.issue.number,
            repo_id: repo.id,
            org_id: repo.org_id,
            title: payload.issue.title,
            url: payload.issue.html_url,
            stake_amount: stakeAmount,
            difficulty,
            trust_multiplier: Number(repo.trust_multiplier),
          });
          console.log(`[Webhook]: Registered stakable issue #${payload.issue.number} for repo ${repo.id}`);
        }
      }
    } else if (payload.action === 'closed') {
      await closeIssue(payload.issue.id);
    }
  }

  else if (event === 'pull_request') {
    const { action, pull_request, repository, sender } = payload;

    // Load repository from DB
    const { data: repo } = await supabase
      .from('repositories')
      .select('id')
      .eq('github_repo_id', repository.id)
      .single();

    if (!repo) return;

    if (action === 'opened') {
      // Load user
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('github_id', sender.id)
        .single();

      if (!user) return;

      // Extract issue reference from description body (e.g. Fixes #12)
      const body = pull_request.body || '';
      const match = body.match(/#(\d+)/);

      if (match) {
        const issueNumber = parseInt(match[1], 10);

        // Find stakable issue
        const { data: issue } = await supabase
          .from('issues')
          .select('id')
          .eq('repo_id', repo.id)
          .eq('github_issue_number', issueNumber)
          .single();

        if (issue) {
          await registerPR({
            github_pr_id: pull_request.id,
            github_pr_number: pull_request.number,
            issue_id: issue.id,
            user_id: user.id,
            repo_id: repo.id,
            title: pull_request.title,
            url: pull_request.html_url,
          });
          console.log(`[Webhook]: Registered PR #${pull_request.number} linking to issue #${issueNumber}`);
        }
      }
    } else if (action === 'closed') {
      // Find registered PR in database
      const { data: pr } = await supabase
        .from('pull_requests')
        .select('id')
        .eq('github_pr_id', pull_request.id)
        .single();

      if (pr) {
        if (pull_request.merged) {
          await handlePRMerged(pr.id);
          console.log(`[Webhook]: Resolved PR #${pull_request.number} as MERGED`);
        } else {
          await handlePRClosed(pr.id);
          console.log(`[Webhook]: Resolved PR #${pull_request.number} as CLOSED (unmerged)`);
        }
      }
    }
  }
}
