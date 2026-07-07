import { Queue } from 'bullmq';
import { connection } from '../config/redis.js';

// Queue names constants
export const QUEUES = {
  WEBHOOK_PROCESSING: 'webhook-processing',
  XP_CALCULATION: 'xp-calculation',
  COIN_MINTING: 'coin-minting',
  ACT_MANAGEMENT: 'act-management',
  AI_SUMMARY: 'ai-summary',
  TREASURY_AUDIT: 'treasury-audit',
} as const;

// Instantiate Queues
export const webhookProcessingQueue = new Queue(QUEUES.WEBHOOK_PROCESSING, { connection: connection as any });
export const xpCalculationQueue = new Queue(QUEUES.XP_CALCULATION, { connection: connection as any });
export const coinMintingQueue = new Queue(QUEUES.COIN_MINTING, { connection: connection as any });
export const actManagementQueue = new Queue(QUEUES.ACT_MANAGEMENT, { connection: connection as any });
export const aiSummaryQueue = new Queue(QUEUES.AI_SUMMARY, { connection: connection as any });
export const treasuryAuditQueue = new Queue(QUEUES.TREASURY_AUDIT, { connection: connection as any });

export const allQueues = [
  webhookProcessingQueue,
  xpCalculationQueue,
  coinMintingQueue,
  actManagementQueue,
  aiSummaryQueue,
  treasuryAuditQueue,
];
