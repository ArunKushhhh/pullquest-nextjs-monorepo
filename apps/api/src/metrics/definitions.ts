import client from 'prom-client';

// Collect default system metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register: client.register });

// ─── API Server Metrics ──────────────────────────────────────────

export const apiRequestsTotal = new client.Counter({
  name: 'pullquest_api_requests_total',
  help: 'Total number of HTTP requests processed by the API server',
  labelNames: ['method', 'route', 'status_code'],
});

export const apiRequestDuration = new client.Histogram({
  name: 'pullquest_api_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10], // customized buckets for API times
});

// ─── Staking & Gamification Metrics ────────────────────────────────

export const stakesTotal = new client.Counter({
  name: 'pullquest_stakes_total',
  help: 'Total number of stakes placed on issues',
  labelNames: ['difficulty'],
});

export const prOutcomesTotal = new client.Counter({
  name: 'pullquest_pr_outcomes_total',
  help: 'Total outcomes of pull requests resolved in the system',
  labelNames: ['outcome'], // MERGED, REJECTED, CLOSED_WITHOUT_MERGE
});

export const xpAwardedTotal = new client.Counter({
  name: 'pullquest_xp_awarded_total',
  help: 'Total XP points awarded to developers',
});

export const coinsMintedTotal = new client.Counter({
  name: 'pullquest_coins_minted_total',
  help: 'Total coins minted in the system',
  labelNames: ['type'], // SIGNUP_BONUS, MONTHLY_MINT, MERGE_BONUS
});

// ─── Treasury & Active State ───────────────────────────────────────

export const treasuryBalance = new client.Gauge({
  name: 'pullquest_treasury_balance',
  help: 'Current balance of organization treasuries in coins',
  labelNames: ['org_name'],
});

export const activeUsers = new client.Gauge({
  name: 'pullquest_active_users',
  help: 'Total registered users in PullQuest',
});

// ─── Worker & Jobs Metrics ────────────────────────────────────────

export const jobQueueDepth = new client.Gauge({
  name: 'pullquest_job_queue_depth',
  help: 'Current depth of BullMQ worker queues',
  labelNames: ['queue_name'],
});

export const jobsFailedTotal = new client.Gauge({
  name: 'pullquest_jobs_failed_total',
  help: 'Cumulative count of failed BullMQ jobs (from queue failed set)',
  labelNames: ['queue_name'],
});

export const leaderboardUpdateDuration = new client.Histogram({
  name: 'pullquest_leaderboard_update_duration_seconds',
  help: 'Duration of leaderboard rebuilds/updates in seconds',
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

export const metricsRegistry = client.register;
export { client as promClient };
