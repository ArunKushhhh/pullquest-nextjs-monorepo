import crypto from 'crypto';
import { webhookProcessingQueue } from '../config/queues.js';

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
  console.log(`[GitHub Webhook]: Queueing event "${event}" (action: ${payload?.action}) to background queue`);
  await webhookProcessingQueue.add('process-github-event', { event, payload });
}
