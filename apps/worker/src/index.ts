import { initSentry } from './config/sentry.js';

// Initialize Sentry before other imports
initSentry();

import { Worker } from 'bullmq';
import { connection } from './config/redis.js';
import { QUEUES, coinMintingQueue } from './queues/index.js';

// Import Job Processors
import processWebhook from './jobs/webhook.processor.js';
import processXP from './jobs/xp.processor.js';
import processCoinMinting from './jobs/coinMinting.processor.js';
import processActReset from './jobs/actReset.processor.js';
import processAISummary from './jobs/aiSummary.processor.js';
import processTreasuryAudit from './jobs/treasuryAudit.processor.js';

console.log('[Worker]: Initializing background workers...');

// 1. Create Workers for each queue
const webhookWorker = new Worker(QUEUES.WEBHOOK_PROCESSING, processWebhook, { connection: connection as any });
const xpWorker = new Worker(QUEUES.XP_CALCULATION, processXP, { connection: connection as any });
const coinWorker = new Worker(QUEUES.COIN_MINTING, processCoinMinting, { connection: connection as any });
const actWorker = new Worker(QUEUES.ACT_MANAGEMENT, processActReset, { connection: connection as any });
const aiWorker = new Worker(QUEUES.AI_SUMMARY, processAISummary, { connection: connection as any });
const treasuryWorker = new Worker(QUEUES.TREASURY_AUDIT, processTreasuryAudit, { connection: connection as any });

const workers = [
  webhookWorker,
  xpWorker,
  coinWorker,
  actWorker,
  aiWorker,
  treasuryWorker,
];

// 2. Setup Repeatable Cron Jobs on Startup
async function setupCronJobs() {
  try {
    // Add repeatable job: monthly coin mint on the 1st of every month at midnight
    await coinMintingQueue.add(
      'monthly-mint',
      {},
      {
        repeat: {
          pattern: '0 0 1 * *',
        },
        jobId: 'monthly-mint-job',
      }
    );
    console.log('[Worker]: Monthly coin mint cron job scheduled successfully.');
  } catch (err) {
    console.error('[Worker]: Error scheduling cron jobs:', err);
  }
}

setupCronJobs();

console.log('[Worker]: Background worker services are fully running.');

// 3. Graceful Shutdown
const shutdown = async () => {
  console.log('[Worker]: Closing all workers...');
  try {
    await Promise.all(workers.map((w) => w.close()));
    console.log('[Worker]: All workers closed successfully.');
    
    await connection.quit();
    console.log('[Worker]: Redis connection closed.');
  } catch (err) {
    console.error('[Worker]: Error during shutdown:', err);
  }
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
