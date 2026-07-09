import { Queue } from 'bullmq';
import { redis } from './redis.js';

export const QUEUES = {
  WEBHOOK_PROCESSING: 'webhook-processing',
  XP_CALCULATION: 'xp-calculation',
  AI_SUMMARY: 'ai-summary',
} as const;

export const webhookProcessingQueue = new Queue(QUEUES.WEBHOOK_PROCESSING, { connection: redis as any });
export const xpCalculationQueue = new Queue(QUEUES.XP_CALCULATION, { connection: redis as any });
export const aiSummaryQueue = new Queue(QUEUES.AI_SUMMARY, { connection: redis as any });
