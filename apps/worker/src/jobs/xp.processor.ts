import { Job } from 'bullmq';

/**
 * XP is awarded in-process by API XPService when a maintainer submits
 * an evaluation. Ignore stale queued jobs so they cannot double-pay.
 */
export default async function processXP(job: Job): Promise<void> {
  console.log(
    `[Worker XP Job]: Skipping PR ${job.data?.prId} — XP is awarded by API XPService`
  );
  await job.updateProgress(100);
}
