import crypto from 'crypto';
import { webhookProcessingQueue } from '../config/queues.js';
import { handlePullRequestGitHubEvent } from './pr.service.js';

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
  // PR lifecycle is owned by PRService so outcomes, coins, and metrics stay in one path (PRD §2.3 / §7.4).
  if (event === 'pull_request' || event === 'pull_request_review') {
    console.log(
      `[GitHub Webhook]: Handling "${event}" (action: ${payload?.action}) via PRService`
    );
    await handlePullRequestGitHubEvent(event, payload);
    return;
  }

  console.log(`[GitHub Webhook]: Queueing event "${event}" (action: ${payload?.action}) to background queue`);
  await webhookProcessingQueue.add('process-github-event', { event, payload });
}
