/**
 * Seed the PullQuest Knowledge Graph in Neo4j from the PRD.
 *
 * Graph model:
 *   (:Project)-[:HAS_PHASE]->(:Phase)-[:CONTAINS]->(:Feature)
 *   (:Feature)-[:IMPLEMENTED_IN]->(:Component)
 *   (:Feature)-[:DEPENDS_ON]->(:Feature)
 *   (:Feature)-[:RECOMMENDED_SKILL]->(:Skill)
 *   (:Feature)-[:USES_SERVICE]->(:Service)        PRD §6.4
 *   (:Feature)-[:EMITS_METRIC]->(:Metric)        PRD §8.4
 *   (:Feature)-[:EXPOSES_ROUTE]->(:Route)         PRD §6.3
 *   (:Feature)-[:USES_REDIS]->(:RedisUseCase)     PRD §6.5 / §8.2
 *   (:Feature)-[:SERVES_ROLE]->(:UserRole)        PRD §1
 *   (:Feature)-[:HANDLES_OUTCOME]->(:PROutcome)   PRD §2.3
 *   (:Feature)-[:USES_DIFFICULTY]->(:Difficulty)  PRD §2.2 / §2.4
 *   (:Project)-[:HAS_TIER]->(:Tier)               PRD §2.6
 *   (:Project)-[:DEFINES_RULE]->(:ProductRule)    PRD §1 rules + §2.7 economy
 *   (:Workflow)-[:STEP_OF]->(:Feature)            PRD §4 workflows
 *   (:Feature)-[:LISTENS_FOR]->(:WebhookEvent)    PRD §3.2
 *   (:Project)-[:HAS_TRUST_MULTIPLIER]->(:TrustMultiplier)  PRD §2.4
 *   (:Feature)-[:APPLIES_TRUST]->(:TrustMultiplier)
 *   (:Feature)-[:PERSISTS_FIELD]->(:InstallationField)     PRD §3.4
 *   (:Feature)-[:PROVISIONS_DASHBOARD]->(:GrafanaDashboard) PRD §8.5
 *   (:Feature)-[:MONITORS_VIA]->(:SentrySurface)             PRD §8.3
 *   (:Feature)-[:HAS_ALERT]->(:GrafanaAlert)                 PRD §8.5
 *   (:PrdSection)-[:REQUIRES]->(:Feature)                    PRD coverage
 *   (:Project)-[:DEFERRED]->(:PostLaunchItem)                PRD §10 future
 *   (:Component)-[:CONNECTS_TO]->(:Infrastructure)
 *   (:Component)-[:DEFINES_TABLE]->(:DatabaseTable) PRD §6.2
 *   (:Component)-[:RUNS_JOB]->(:Job)-[:IMPLEMENTS]->(:Feature)  PRD §6.6
 *
 * Feature.status: 'done' | 'partial' | 'todo' — reflects actual repo state.
 * PRD §10: full platform build (no MVP phasing). Post-launch items excluded.
 * Update statuses here (or via Neo4j Browser at :7474) as features complete,
 * then re-run: pnpm kg:seed  (idempotent — uses MERGE).
 */
import neo4j from 'neo4j-driver';
import { getNeo4jConfig } from './kg-config';

const { uri: URI, user: USER, password: PASSWORD } = getNeo4jConfig();

type Status = 'done' | 'partial' | 'todo';

interface Feature {
  name: string;
  prd: string; // PRD section reference
  phase: string;
  status: Status;
  components: string[];
  dependsOn?: string[];
  skills: string[]; // installed skill/plugin names best suited for this feature
  services?: string[]; // PRD §6.4 service-layer services used by this feature
  metrics?: string[]; // PRD §8.4 Prometheus metrics emitted by this feature
  roles?: string[]; // PRD §1 user roles served by this feature
  outcomes?: string[]; // PRD §2.3 PR outcomes handled by this feature
  difficulties?: string[]; // PRD §2.2 difficulty bands used by this feature
  webhooks?: string[]; // PRD §3.2 GitHub webhook events consumed
  note?: string;
}

interface RouteDef {
  method: string;
  path: string;
  prd: string;
  feature: string;
  purpose: string;
}

interface RedisUseCase {
  name: string;
  dataStructure: string;
  keyPattern: string;
  ttl: string;
  feature: string;
}

const PHASES = [
  { name: 'Foundation', order: 1 },
  { name: 'Data Layer', order: 2 },
  { name: 'Backend Core', order: 3 },
  { name: 'Worker & Jobs', order: 4 },
  { name: 'Frontend', order: 5 },
  { name: 'Integrations', order: 6 },
  { name: 'Observability', order: 7 },
];

const COMPONENTS = [
  { name: 'web', path: 'apps/web', type: 'app' },
  { name: 'api', path: 'apps/api', type: 'app' },
  { name: 'worker', path: 'apps/worker', type: 'app' },
  { name: 'shared', path: 'packages/shared', type: 'package' },
  { name: 'database', path: 'packages/database', type: 'package' },
  { name: 'infra', path: 'infra', type: 'infra' },
  { name: 'scripts', path: 'scripts', type: 'tooling' },
];

// PRD §6.4 Service Layer — domain services encapsulating business logic.
const SERVICES: { name: string; description: string }[] = [
  { name: 'AuthService', description: 'Validate Supabase JWTs, resolve GitHub user, one-account-per-GitHub enforcement' },
  { name: 'WebhookService', description: 'Verify GitHub webhook signatures, parse events, dispatch to handlers' },
  { name: 'InstallationService', description: 'Handle GitHub App install/uninstall events, store installation_id + repos' },
  { name: 'IssueService', description: 'Detect Stake-X label, parse difficulty band, register stakable issues' },
  { name: 'StakeService', description: 'Validate coin balance, lock coins, record stake, register participant' },
  { name: 'PRService', description: 'Link PRs to staked issues, detect outcome, execute resolution logic' },
  { name: 'XPService', description: 'Calculate XP: Cap × (Eval/5) × Trust Multiplier, update Redis leaderboard' },
  { name: 'EvaluationService', description: 'Serve questionnaire, validate responses, block merge without evaluation' },
  { name: 'LeaderboardService', description: 'Redis sorted set ops, global + per-org, cache paginated results' },
  { name: 'CoinService', description: 'Signup coins, monthly minting, merge bonuses, Stripe purchase flows' },
  { name: 'TreasuryService', description: 'Credit rejected deductions, debit compensation, enforce -2000 debt ceiling' },
  { name: 'ActService', description: 'Track current Act, execute Act reset, archive leaderboards (BullMQ)' },
  { name: 'OrgService', description: 'Org onboarding, trial tracking, subscription status, aggregate metrics' },
  { name: 'AIService', description: 'Gemini issue/PR summaries, pullquestai comments, maintainer correction loop' },
  { name: 'CredibilityService', description: 'Calculate org credibility 0-100 (treasury, contributors, repos, activity)' },
];

// PRD §8.1 Infrastructure — external/managed services components connect to.
const INFRASTRUCTURE: { name: string; kind: string; detail: string }[] = [
  { name: 'Supabase Postgres', kind: 'db', detail: 'Primary DB: users, installations, issues, stakes, prs, xp, coins, orgs, treasuries, acts' },
  { name: 'Supabase Auth', kind: 'auth', detail: 'GitHub OAuth provider, JWT issuance, session management' },
  { name: 'Supabase Realtime', kind: 'realtime', detail: 'Live leaderboard position changes, stake notifications, PR status updates' },
  { name: 'Redis', kind: 'cache', detail: 'Leaderboard sorted sets, rate limiting, session augmentation, BullMQ queues' },
  { name: 'BullMQ', kind: 'queue', detail: 'Redis-backed job queues: webhook, xp, coin-minting, act-management, ai-summary, treasury-audit' },
  { name: 'GitHub OAuth App', kind: 'integration', detail: 'Authentication only: read:user, user:email scopes' },
  { name: 'GitHub App', kind: 'integration', detail: 'Repo + webhook access, pullquestai comments (Vercel-style install)' },
  { name: 'Stripe', kind: 'integration', detail: 'Coin purchases, org subscriptions, webhook payments' },
  { name: 'Google Gemini', kind: 'integration', detail: 'AI layer: issue/PR structural summaries' },
  { name: 'Sentry', kind: 'observability', detail: 'Error tracking + perf monitoring (API, worker, web SDKs)' },
  { name: 'Prometheus', kind: 'observability', detail: 'Metrics scraping :9090' },
  { name: 'Grafana', kind: 'observability', detail: 'Dashboards + alerting :3002' },
  { name: 'Neo4j', kind: 'knowledge-graph', detail: 'Knowledge graph store for KG tooling' },
];

// PRD §8.4 Prometheus custom metrics.
const METRICS: { name: string; type: string; description: string }[] = [
  { name: 'pullquest_api_requests_total', type: 'Counter', description: 'Total API requests by route, method, status' },
  { name: 'pullquest_api_request_duration_seconds', type: 'Histogram', description: 'Request latency' },
  { name: 'pullquest_stakes_total', type: 'Counter', description: 'Total stakes placed' },
  { name: 'pullquest_pr_outcomes_total', type: 'Counter', description: 'PR outcomes by type (merged/rejected/multiple/closed/unreviewed)' },
  { name: 'pullquest_xp_awarded_total', type: 'Counter', description: 'Total XP awarded' },
  { name: 'pullquest_coins_minted_total', type: 'Counter', description: 'Coins minted (signup, monthly, bonus)' },
  { name: 'pullquest_treasury_balance', type: 'Gauge', description: 'Org treasury balances' },
  { name: 'pullquest_active_users', type: 'Gauge', description: 'Users active in current Act' },
  { name: 'pullquest_job_queue_depth', type: 'Gauge', description: 'BullMQ queue depths' },
  { name: 'pullquest_leaderboard_update_duration_seconds', type: 'Histogram', description: 'Leaderboard write latency' },
  { name: 'act_reset_duration_seconds', type: 'Histogram', description: 'Act reset job runtime emitted during seasonal reset' },
  { name: 'users_processed_total', type: 'Counter', description: 'Users processed during Act reset' },
];

// PRD §6.6 BullMQ worker jobs.
interface JobDef {
  name: string;
  queue: string;
  trigger: string;
  implementsFeature?: string; // Feature the job implements/enables
  runsIn: 'worker' | 'api';
}
const JOBS: JobDef[] = [
  { name: 'process-github-event', queue: 'webhook-processing', trigger: 'GitHub webhook received', implementsFeature: 'Webhook Processing Queue', runsIn: 'worker' },
  { name: 'calculate-xp', queue: 'xp-calculation', trigger: 'Maintainer submits evaluation', implementsFeature: 'XP Scoring Engine', runsIn: 'worker' },
  { name: 'monthly-mint', queue: 'coin-minting', trigger: 'BullMQ cron: 0 0 1 * *', implementsFeature: 'Monthly Coin Minting', runsIn: 'worker' },
  { name: 'act-reset', queue: 'act-management', trigger: 'BullMQ cron: every 45 days', implementsFeature: 'Act Reset Job', runsIn: 'worker' },
  { name: 'generate-issue-summary', queue: 'ai-summary', trigger: 'New stakable issue detected', implementsFeature: 'AI Assistance Layer', runsIn: 'worker' },
  { name: 'generate-pr-summary', queue: 'ai-summary', trigger: 'PR opened on staked issue', implementsFeature: 'AI Assistance Layer', runsIn: 'worker' },
  { name: 'check-debt-ceiling', queue: 'treasury-audit', trigger: 'After each treasury transaction', implementsFeature: 'Treasury Audit Job', runsIn: 'worker' },
];

const COMPONENT_CONNECTIONS: Record<string, string[]> = {
  web: ['Supabase Auth', 'Supabase Realtime', 'Sentry'],
  api: ['Supabase Postgres', 'Supabase Auth', 'Supabase Realtime', 'Redis', 'BullMQ', 'GitHub OAuth App', 'GitHub App', 'Stripe', 'Prometheus', 'Sentry'],
  worker: ['Supabase Postgres', 'Redis', 'BullMQ', 'GitHub App', 'Google Gemini', 'Sentry'],
  shared: [],
  database: ['Supabase Postgres'],
  infra: ['Prometheus', 'Grafana', 'Redis', 'Neo4j'],
  scripts: ['Neo4j'],
};

const DATABASE_TABLES = [
  'users',
  'installations',
  'repositories',
  'issues',
  'stakes',
  'pull_requests',
  'evaluations',
  'xp_logs',
  'coins',
  'transactions',
  'organizations',
  'treasuries',
  'acts',
  'leaderboard_archives',
];

const ROUTES: RouteDef[] = [
  { method: 'POST', path: '/api/webhooks/github', prd: '§6.3', feature: 'Webhook Processing Queue', purpose: 'GitHub App webhook receiver for issues, PRs, installations' },
  { method: 'POST', path: '/api/webhooks/stripe', prd: '§6.3', feature: 'Stripe Payments', purpose: 'Stripe webhook receiver for payments and subscriptions' },
  { method: 'GET', path: '/api/auth/me', prd: '§6.3', feature: 'Authentication & Identity', purpose: 'Get current user profile after Supabase JWT validation' },
  { method: 'POST', path: '/api/auth/callback', prd: '§7.1', feature: 'Authentication & Identity', purpose: 'Create/update PullQuest user after Supabase GitHub OAuth callback' },
  { method: 'GET', path: '/api/issues', prd: '§6.3', feature: 'Issues Feed', purpose: 'List stakable issues with org, difficulty, and status filters' },
  { method: 'POST', path: '/api/issues/:id/stake', prd: '§6.3', feature: 'Issue Staking System', purpose: 'Stake coins on an issue' },
  { method: 'GET', path: '/api/stakes/mine', prd: '§6.3', feature: 'Issue Staking System', purpose: 'List the authenticated user active stakes' },
  { method: 'POST', path: '/api/prs/:id/evaluate', prd: '§6.3', feature: 'Maintainer Evaluation', purpose: 'Submit maintainer evaluation for a pull request' },
  { method: 'GET', path: '/api/leaderboard/global', prd: '§6.3', feature: 'Tiers & Leaderboards', purpose: 'Read global Redis-backed leaderboard' },
  { method: 'GET', path: '/api/leaderboard/org/:orgId', prd: '§6.3', feature: 'Tiers & Leaderboards', purpose: 'Read organization Redis-backed leaderboard' },
  { method: 'GET', path: '/api/users/:userId/profile', prd: '§6.3', feature: 'Contributor Profile', purpose: 'Public contributor profile' },
  { method: 'GET', path: '/api/users/:userId/history', prd: '§6.3', feature: 'Contributor Profile', purpose: 'Contribution and PR history' },
  { method: 'GET', path: '/api/users/:userId/stakes', prd: '§6.3', feature: 'Contributor Profile', purpose: 'Authenticated personal stake history' },
  { method: 'POST', path: '/api/coins/create-checkout-session', prd: '§6.3', feature: 'Stripe Payments', purpose: 'Create Stripe Checkout session for coin bundle purchase' },
  { method: 'GET', path: '/api/coins/purchase-history', prd: '§6.3', feature: 'Coin Economy', purpose: 'Read coin purchase transaction history' },
  { method: 'GET', path: '/api/orgs/:orgId/dashboard', prd: '§6.3', feature: 'Org Dashboard UI', purpose: 'Organization dashboard data' },
  { method: 'GET', path: '/api/orgs/:orgId/treasury', prd: '§6.3', feature: 'Org Treasury', purpose: 'Organization treasury balance for admins' },
  { method: 'POST', path: '/api/orgs/:orgId/subscribe', prd: '§6.3', feature: 'Stripe Payments', purpose: 'Initiate Stripe organization subscription' },
  { method: 'GET', path: '/api/installations/status', prd: '§6.3', feature: 'GitHub App Installations', purpose: 'GitHub App installation status for current user' },
  { method: 'GET', path: '/api/acts/current', prd: '§6.3', feature: 'Seasonal System (Acts)', purpose: 'Current Act info and days remaining' },
  { method: 'GET', path: '/api/metrics', prd: '§6.3', feature: 'Prometheus Metrics', purpose: 'Prometheus metrics endpoint' },
  { method: 'GET', path: '/api/health', prd: '§6.3', feature: 'Docker Compose Stack', purpose: 'Health check used by Docker and Prometheus' },
];

const REDIS_USE_CASES: RedisUseCase[] = [
  { name: 'Global Leaderboard', dataStructure: 'Sorted Set', keyPattern: 'leaderboard:global:act:{actId}', ttl: 'None', feature: 'Tiers & Leaderboards' },
  { name: 'Org Leaderboard', dataStructure: 'Sorted Set', keyPattern: 'leaderboard:org:{orgId}:act:{actId}', ttl: 'None', feature: 'Tiers & Leaderboards' },
  { name: 'User Profile Cache', dataStructure: 'Hash', keyPattern: 'cache:user:{userId}', ttl: '5 min', feature: 'Contributor Profile' },
  { name: 'Org Credibility Cache', dataStructure: 'String', keyPattern: 'cache:credibility:{orgId}', ttl: '15 min', feature: 'Credibility Score' },
  { name: 'Issue Metadata Cache', dataStructure: 'Hash', keyPattern: 'cache:issue:{issueId}', ttl: '2 min', feature: 'Issue Staking System' },
  { name: 'Rate Limiting', dataStructure: 'String counter', keyPattern: 'ratelimit:{ip}:{window}', ttl: 'Window size', feature: 'Rate Limiting & Middleware' },
  { name: 'Session Augmentation', dataStructure: 'Hash', keyPattern: 'session:{userId}', ttl: '30 min', feature: 'Authentication & Identity' },
  { name: 'BullMQ Queues', dataStructure: 'Lists + Sets', keyPattern: 'bull:{queueName}:*', ttl: 'Job-specific', feature: 'Webhook Processing Queue' },
];

// Installed skills/plugins/MCP referenced by RECOMMENDED_SKILL edges.
const SKILLS: Record<string, string> = {
  'supabase:supabase': 'Supabase products: DB, Auth, RLS, Realtime, migrations',
  'supabase:supabase-postgres-best-practices': 'Postgres schema + query optimization',
  'supabase-mcp': 'Supabase MCP: apply_migration, execute_sql, get_advisors, logs',
  'vercel:nextjs': 'Next.js App Router patterns, caching, routing',
  'vercel:shadcn': 'shadcn/ui component library usage',
  'vercel:react-best-practices': 'React server/client component best practices',
  'frontend-design:frontend-design': 'Production-quality frontend design',
  'dataviz': 'Charts and dashboard visualization design',
  'engineering-skills:senior-backend': 'Express service-layer architecture review',
  'engineering-skills:senior-frontend': 'Frontend architecture review',
  'engineering-skills:senior-devops': 'Docker, CI/CD, infra review',
  'engineering-skills:stripe-integration-expert': 'Stripe checkout, webhooks, subscriptions',
  'engineering-skills:tdd-guide': 'Test-driven development workflow',
  'engineering-skills:code-reviewer': 'Code review before merge',
  'engineering-skills:security-pen-testing': 'Webhook signature + auth security audit',
  'engineering-advanced-skills:database-designer': 'Schema design + migration architecture',
  'engineering-advanced-skills:api-design-reviewer': 'REST API design review',
  'engineering-advanced-skills:observability-designer': 'Metrics, dashboards, alerting design',
  'engineering-advanced-skills:performance-profiler': 'Performance profiling',
  'sentry:sentry-instrument': 'Sentry SDK instrumentation',
  'sentry:sentry-workflow': 'Sentry issue triage workflow',
  'grafana-mcp:grafana-mcp-tools': 'Grafana dashboard management via MCP',
  'pw:generate': 'Playwright E2E test generation',
  'pw:fix': 'Playwright flaky/failing test diagnosis',
  'gstack:/qa': 'Browser QA testing of web app',
  'gstack:/review': 'Diff review for production bugs',
  'gstack:/ship': 'Ship workflow: tests, review, version, PR',
  'gstack:/investigate': 'Systematic debugging with root cause analysis',
  'gstack:/browse': 'Headless browser for web browsing',
  'llm-api': 'LLM API reference (Gemini integration patterns)',
  'code-review:code-review': 'Diff correctness review',
  'verify': 'End-to-end change verification',
  'caveman:caveman': 'Token-compressed communication mode',
};

// PRD §1 — user roles and platform rules.
const USER_ROLES: { name: string; codeName: string; permissions: string }[] = [
  {
    name: 'Contributor',
    codeName: 'CONTRIBUTOR',
    permissions: 'Profile, stake on issues, submit PRs, earn XP/tiers, leaderboards, coin packs, contribution history, AI summaries',
  },
  {
    name: 'Maintainer',
    codeName: 'MAINTAINER',
    permissions: 'Create staked issues, set difficulty, review PRs, mandatory merge evaluation, AI correction loop',
  },
  {
    name: 'Organization',
    codeName: 'ORG_ADMIN',
    permissions: 'Org dashboard, org leaderboard, treasury (internal), credibility (public), subscription, contributor analytics',
  },
  {
    name: 'Platform Admin',
    codeName: 'PLATFORM_ADMIN',
    permissions: 'One GitHub account per user, moderation, coin supply/treasury health, Act resets, trust multiplier integrity',
  },
];

// PRD §2.6 + packages/shared — tier progression.
const TIERS: { name: string; xpMin: number | null; xpMax: number | null; order: number; baseCoins?: number; note?: string }[] = [
  { name: 'Unranked', xpMin: null, xpMax: null, order: 0, note: 'Every Act start; visible on leaderboard after first merged PR' },
  { name: 'Initiator', xpMin: 0, xpMax: 100, order: 1, baseCoins: 50 },
  { name: 'Commiter', xpMin: 100, xpMax: 500, order: 2, baseCoins: 100 },
  { name: 'Contributor', xpMin: 500, xpMax: 1500, order: 3, baseCoins: 150 },
  { name: 'Merge Master', xpMin: 1500, xpMax: 3000, order: 4, baseCoins: 200 },
  { name: 'Architect', xpMin: 3000, xpMax: 5000, order: 5, baseCoins: 300 },
  { name: 'Open Source Legend', xpMin: 5000, xpMax: null, order: 6, baseCoins: 500 },
];

// PRD §2.3 — five PR resolution outcomes.
const PR_OUTCOMES: { name: string; codeName: string; resolution: string }[] = [
  { name: 'Merged', codeName: 'MERGED', resolution: 'Stake returned + bonus coins + XP after maintainer evaluation' },
  { name: 'Rejected', codeName: 'REJECTED', resolution: '50% stake to org treasury, 50% refunded (closed unmerged + latest review changes_requested)' },
  { name: 'Multiple Accepted', codeName: 'MULTIPLE_ACCEPTED', resolution: 'Equal reward and XP split across accepted PRs' },
  { name: 'Closed without Merge', codeName: 'CLOSED_WITHOUT_MERGE', resolution: 'Full stake refund + 30% treasury compensation to contributor' },
  { name: 'Unreviewed', codeName: 'UNREVIEWED', resolution: 'Full stake refund' },
];

// PRD §2.2 / §2.4 + packages/shared — difficulty bands.
const DIFFICULTIES: { name: string; codeName: string; xpCap: number; stakeMin: number; stakeMax: number }[] = [
  { name: 'Easy', codeName: 'EASY', xpCap: 40, stakeMin: 10, stakeMax: 30 },
  { name: 'Medium', codeName: 'MEDIUM', xpCap: 70, stakeMin: 30, stakeMax: 80 },
  { name: 'Hard', codeName: 'HARD', xpCap: 100, stakeMin: 80, stakeMax: 200 },
];

// PRD §3.2 — GitHub App webhook events.
const GITHUB_WEBHOOK_EVENTS: { event: string; purpose: string; feature: string }[] = [
  { event: 'issues', purpose: 'Detect Stake-X label and difficulty on new/updated issues', feature: 'Issue Staking System' },
  { event: 'issue_comment', purpose: 'Track maintainer AI correction threads', feature: 'AI Assistance Layer' },
  { event: 'pull_request', purpose: 'Link PRs to stakes, detect merge/close outcomes', feature: 'PR Lifecycle & Resolution' },
  { event: 'pull_request_review', purpose: 'Distinguish rejected (changes_requested) vs closed-without-merge', feature: 'PR Lifecycle & Resolution' },
  { event: 'installation', purpose: 'Store GitHub App installation_id and account metadata', feature: 'GitHub App Installations' },
  { event: 'installation_repositories', purpose: 'Sync granted repo list on add/remove', feature: 'GitHub App Installations' },
];

// PRD §4 — primary user workflows (step counts from PRD).
const WORKFLOWS: { name: string; prd: string; steps: number; primaryRole: string }[] = [
  { name: 'Contributor Workflow', prd: '§4.1', steps: 9, primaryRole: 'Contributor' },
  { name: 'Maintainer Workflow', prd: '§4.2', steps: 4, primaryRole: 'Maintainer' },
  { name: 'Organization Workflow', prd: '§4.3', steps: 3, primaryRole: 'Organization' },
  { name: 'Seasonal Act Lifecycle', prd: '§4.4', steps: 3, primaryRole: 'Platform Admin' },
];

// PRD §1 rules + §2.7 / packages/shared — immutable product rules.
const PRODUCT_RULES: { name: string; prd: string; value: string }[] = [
  { name: 'Signup coins', prd: '§2.7', value: '150 coins on account creation' },
  { name: 'Monthly coins', prd: '§2.7', value: '100 coins on 1st of month (BullMQ cron)' },
  { name: 'Coin bundles', prd: '§2.7', value: 'Purchasable once per Act via Stripe' },
  { name: 'Purchased coins', prd: '§2.7', value: 'Never diluted; unaffected by Act reset' },
  { name: 'Coins do not affect XP', prd: '§2.7', value: 'Coin balance and purchases never change XP or tier' },
  { name: 'Coins not ranked publicly', prd: '§2.7', value: 'Coin balances are not shown on leaderboards' },
  { name: 'Public contribution history', prd: '§1', value: 'Stakes, PR outcomes, and XP earned are publicly visible' },
  { name: 'Treasury debt ceiling', prd: '§2.7', value: '−2000 coins; staking disabled beyond limit' },
  { name: 'Rejection deduction', prd: '§2.3', value: '50% of stake to org treasury on rejected PR' },
  { name: 'Closed compensation', prd: '§2.3', value: '30% treasury compensation to contributor on closed-without-merge' },
  { name: 'Merge bonus coins', prd: '§2.3', value: 'Easy +10, Medium +25, Hard +50 bonus coins on merge' },
  { name: 'Act duration', prd: '§2.5', value: '45 days per Act' },
  { name: 'Act tier drop', prd: '§2.5', value: 'Exactly one tier; XP to midpoint of lower tier' },
  { name: 'Initiator Act reset', prd: '§2.5', value: 'Initiator XP reset to 50% at Act end' },
  { name: 'Tier activation', prd: '§2.5', value: 'At least one merged PR required to leave Unranked' },
  { name: 'One GitHub account', prd: '§1', value: 'One GitHub account linked to one PullQuest account' },
  { name: 'Mandatory Stake-X label', prd: '§1', value: 'Stake-X label required for issue participation' },
  { name: 'Exact stake amount', prd: '§2.2', value: 'Contributor must stake exact Stake-X amount; deducted immediately' },
  { name: 'XP formula', prd: '§2.4', value: 'Final XP = Cap × (Evaluation / 5) × Trust Multiplier' },
  { name: 'No manual XP override', prd: '§2.4', value: 'XP is system-calculated; no negative XP' },
  { name: 'Org trial', prd: '§4.3', value: '10-day free trial; Stripe subscription required after' },
  { name: 'Credibility range', prd: '§2.9', value: '0–100 based on treasury, contributors, repos, activity' },
  { name: 'Treasury not public', prd: '§2.9', value: 'Raw org treasury balance is internal-only; credibility is public' },
  { name: 'AI never assigns XP', prd: '§2.10', value: 'Gemini summaries only; XP requires maintainer evaluation' },
];

// PRD §2.4 + packages/shared — trust multiplier brackets (highest applicable wins).
const TRUST_MULTIPLIERS: { label: string; minMembers: number; maxMembers: number; minStars: number; multiplier: number }[] = [
  { label: '1–5 members', minMembers: 1, maxMembers: 5, minStars: 0, multiplier: 0.5 },
  { label: '5–20 members', minMembers: 5, maxMembers: 20, minStars: 0, multiplier: 0.8 },
  { label: '100+ stars', minMembers: 0, maxMembers: Infinity, minStars: 100, multiplier: 1.0 },
  { label: '1k+ stars', minMembers: 0, maxMembers: Infinity, minStars: 1000, multiplier: 1.5 },
];

// PRD §3.4 — GitHub App installation record fields.
const INSTALLATION_FIELDS: { field: string; description: string }[] = [
  { field: 'installation_id', description: 'GitHub App installation ID' },
  { field: 'account_type', description: 'User or Organization' },
  { field: 'account_id', description: 'GitHub account ID' },
  { field: 'account_login', description: 'GitHub username or org name' },
  { field: 'repositories', description: 'List of repo IDs and names granted' },
  { field: 'permissions', description: 'Granted permission set' },
  { field: 'installed_by', description: 'PullQuest user ID who triggered installation' },
  { field: 'installed_at', description: 'Installation timestamp' },
];

// PRD §8.5 — Grafana pre-provisioned dashboards.
const GRAFANA_DASHBOARDS: { name: string; focus: string }[] = [
  { name: 'API Overview', focus: 'Request rates, latency p50/p95/p99, error rates, top endpoints' },
  { name: 'Coin Economy', focus: 'Minting rates, staking volume, treasury health, debt ceiling proximity' },
  { name: 'Leaderboard & XP', focus: 'XP distribution, tier distribution, leaderboard update frequency' },
  { name: 'Worker & Queues', focus: 'Job completion/failure rates, queue depths, Act reset duration' },
];

// PRD §8.3 — Sentry integration surfaces and critical alerts.
const SENTRY_INTEGRATION_POINTS: { surface: string; detail: string }[] = [
  { surface: 'API server', detail: 'Unhandled exceptions, transaction traces, request breadcrumbs' },
  { surface: 'Worker', detail: 'Job failures, queue errors, Act reset issues' },
  { surface: 'Frontend', detail: 'Client errors, performance monitoring, session replay' },
  { surface: 'Custom context', detail: 'User ID, org ID, Act number on all events' },
  { surface: 'Treasury debt alert', detail: 'Critical alert on debt ceiling breach' },
  { surface: 'XP calculation alert', detail: 'Critical alert on XP calculation failures' },
  { surface: 'Payment alert', detail: 'Critical alert on Stripe/payment errors' },
  { surface: 'Webhook signature alert', detail: 'Critical alert on GitHub webhook signature failures' },
];

// PRD §4 — workflow step → feature mapping for STEP_OF edges.
const WORKFLOW_STEPS: { workflow: string; step: number; feature: string; description: string }[] = [
  { workflow: 'Contributor Workflow', step: 1, feature: 'Authentication & Identity', description: 'GitHub OAuth login; 150 signup coins' },
  { workflow: 'Contributor Workflow', step: 2, feature: 'GitHub App Installations', description: 'Install GitHub App; select repos' },
  { workflow: 'Contributor Workflow', step: 3, feature: 'Issues Feed', description: 'Browse Home/Feed for staked and stakable issues' },
  { workflow: 'Contributor Workflow', step: 4, feature: 'Issue Staking System', description: 'Stake exact coins; coins locked' },
  { workflow: 'Contributor Workflow', step: 5, feature: 'PR Lifecycle & Resolution', description: 'Submit PR on GitHub; webhook links to stake' },
  { workflow: 'Contributor Workflow', step: 6, feature: 'AI Assistance Layer', description: 'Maintainer review; AI PR summary' },
  { workflow: 'Contributor Workflow', step: 7, feature: 'PR Lifecycle & Resolution', description: 'Automated financial outcome by PR result' },
  { workflow: 'Contributor Workflow', step: 8, feature: 'Maintainer Evaluation', description: 'Maintainer MCQ+sliders; XP calculated' },
  { workflow: 'Contributor Workflow', step: 9, feature: 'Tiers & Leaderboards', description: 'First Act merge activates tier; Redis leaderboard update' },
  { workflow: 'Maintainer Workflow', step: 1, feature: 'Issue Staking System', description: 'Create issue with Stake-X + difficulty' },
  { workflow: 'Maintainer Workflow', step: 2, feature: 'AI Assistance Layer', description: 'AI issue summary under pullquestai' },
  { workflow: 'Maintainer Workflow', step: 3, feature: 'PR Lifecycle & Resolution', description: 'Review PR; approve or reject' },
  { workflow: 'Maintainer Workflow', step: 4, feature: 'Maintainer Evaluation', description: 'Mandatory evaluation on merge' },
  { workflow: 'Organization Workflow', step: 1, feature: 'Organization Onboarding & Trial', description: 'Install GitHub App on org; 10-day trial' },
  { workflow: 'Organization Workflow', step: 2, feature: 'Org Treasury', description: 'Treasury receives deductions; pays compensation' },
  { workflow: 'Organization Workflow', step: 3, feature: 'Org Dashboard UI', description: 'Rankings, credibility, treasury (internal), metrics' },
  { workflow: 'Seasonal Act Lifecycle', step: 1, feature: 'Seasonal System (Acts)', description: 'Act start: all Unranked; earned coins reset' },
  { workflow: 'Seasonal Act Lifecycle', step: 2, feature: 'Tiers & Leaderboards', description: 'During Act: dynamic Redis rankings' },
  { workflow: 'Seasonal Act Lifecycle', step: 3, feature: 'Act Reset Job', description: 'Act end: tier drop, XP compression, archive, new Act' },
];

// PRD §10 — explicitly out of scope for current build (documented for coverage audits).
const POST_LAUNCH_ITEMS: { name: string; prd: string }[] = [
  { name: 'Advanced credibility weighting', prd: '§10 future' },
  { name: 'Contributor analytics dashboard', prd: '§10 future' },
  { name: 'Seasonal badges & rewards', prd: '§10 future' },
  { name: 'Reputation export (hiring)', prd: '§10 future' },
  { name: 'Anti-abuse monitoring', prd: '§10 future' },
];

// PRD §8.5 — Grafana alert rules.
const GRAFANA_ALERTS: { name: string; condition: string; feature: string }[] = [
  { name: 'Treasury debt warning', condition: 'Org treasury at −1500 (approaching −2000 ceiling)', feature: 'Grafana Dashboards' },
  { name: 'API error spike', condition: '>5% 5xx responses in 5 minutes', feature: 'Grafana Dashboards' },
  { name: 'Worker job failures', condition: '>3 job failures in 10 minutes', feature: 'Grafana Dashboards' },
  { name: 'Act reset timeout', condition: 'Act reset job not completing within expected window', feature: 'Act Reset Job' },
];

// PRD sections — used for coverage audits in kg:query coverage.
const PRD_SECTIONS: { id: string; title: string; requiredFeature?: string }[] = [
  { id: '§2.1', title: 'Authentication & Identity', requiredFeature: 'Authentication & Identity' },
  { id: '§2.2', title: 'Issue Staking System', requiredFeature: 'Issue Staking System' },
  { id: '§2.3', title: 'PR Lifecycle & Resolution', requiredFeature: 'PR Lifecycle & Resolution' },
  { id: '§2.4', title: 'XP Scoring Engine', requiredFeature: 'XP Scoring Engine' },
  { id: '§2.5', title: 'Seasonal System (Acts)', requiredFeature: 'Seasonal System (Acts)' },
  { id: '§2.6', title: 'Tiers & Leaderboards', requiredFeature: 'Tiers & Leaderboards' },
  { id: '§2.7', title: 'Coin Economy', requiredFeature: 'Coin Economy' },
  { id: '§2.8', title: 'Organization Dashboard', requiredFeature: 'Org Dashboard UI' },
  { id: '§2.9', title: 'Credibility Score', requiredFeature: 'Credibility Score' },
  { id: '§2.10', title: 'AI Assistance Layer', requiredFeature: 'AI Assistance Layer' },
  { id: '§3.1', title: 'GitHub OAuth App (auth only)', requiredFeature: 'Authentication & Identity' },
  { id: '§3.2', title: 'GitHub App (repo + webhooks)', requiredFeature: 'GitHub App Installations' },
  { id: '§4.1', title: 'Contributor Workflow', requiredFeature: 'Issues Feed' },
  { id: '§4.2', title: 'Maintainer Workflow', requiredFeature: 'Maintainer Evaluation' },
  { id: '§4.3', title: 'Organization Workflow', requiredFeature: 'Organization Onboarding & Trial' },
  { id: '§4.4', title: 'Seasonal Act Lifecycle', requiredFeature: 'Seasonal System (Acts)' },
  { id: '§6.2', title: 'Supabase layer (DB, Auth, RLS, Realtime)', requiredFeature: 'Database Schema' },
  { id: '§6.3', title: 'Express API routes & middleware', requiredFeature: 'Rate Limiting & Middleware' },
  { id: '§6.6', title: 'BullMQ worker queues', requiredFeature: 'Webhook Processing Queue' },
  { id: '§7.1', title: 'Authentication flow', requiredFeature: 'Login & Auth Pages' },
  { id: '§8.1', title: 'Docker Compose stack', requiredFeature: 'Docker Compose Stack' },
  { id: '§8.3', title: 'Sentry integration', requiredFeature: 'Sentry Integration' },
  { id: '§8.4', title: 'Prometheus metrics', requiredFeature: 'Prometheus Metrics' },
  { id: '§8.5', title: 'Grafana dashboards & alerts', requiredFeature: 'Grafana Dashboards' },
  { id: '§9', title: 'Monorepo structure', requiredFeature: 'Monorepo Setup' },
  { id: '§10', title: 'Full product scope (no MVP phasing)', requiredFeature: 'Monorepo Setup' },
];

const FEATURES: Feature[] = [
  // Foundation
  { name: 'Monorepo Setup', prd: '§9', phase: 'Foundation', status: 'done',
    components: ['web', 'api', 'worker', 'shared', 'database'],
    skills: ['engineering-skills:senior-devops'] },
  { name: 'Docker Compose Stack', prd: '§8.1', phase: 'Foundation', status: 'done',
    components: ['infra'],
    skills: ['engineering-skills:senior-devops'] },
  { name: 'Shared Types & Constants', prd: '§9.1', phase: 'Foundation', status: 'done',
    components: ['shared'],
    skills: ['engineering-skills:senior-backend'] },
  { name: 'Knowledge Graph Tooling', prd: '—', phase: 'Foundation', status: 'done',
    components: ['scripts'],
    skills: [] },

  // Data Layer
  { name: 'Database Schema', prd: '§6.2', phase: 'Data Layer', status: 'done',
    components: ['database'],
    skills: ['engineering-advanced-skills:database-designer', 'supabase:supabase-postgres-best-practices', 'supabase-mcp'],
    note: '14 tables live; generated Database types wired into API/worker/web clients' },
  { name: 'RLS Policies', prd: '§6.2', phase: 'Data Layer', status: 'done',
    components: ['database'], dependsOn: ['Database Schema'],
    skills: ['supabase:supabase', 'supabase-mcp', 'engineering-skills:security-pen-testing'],
    note: 'users_update_own has WITH CHECK + column grants; role/XP/coins not writable via anon key' },

  // Backend Core
  { name: 'Authentication & Identity', prd: '§2.1', phase: 'Backend Core', status: 'done',
    components: ['api', 'web'], dependsOn: ['Database Schema'],
    skills: ['supabase:supabase', 'engineering-skills:senior-backend'],
    services: ['AuthService'], metrics: ['pullquest_api_requests_total'],
    roles: ['Contributor', 'Maintainer', 'Organization', 'Platform Admin'],
    note: 'Classic GitHub OAuth App + Supabase verified live; signup bonus 150 coins via POST /api/auth/callback' },
  { name: 'GitHub App Installations', prd: '§3.2', phase: 'Backend Core', status: 'done',
    components: ['api', 'web', 'worker'], dependsOn: ['Authentication & Identity'],
    skills: ['engineering-skills:senior-backend', 'engineering-skills:security-pen-testing'],
    services: ['InstallationService', 'WebhookService'],
    roles: ['Contributor', 'Maintainer', 'Organization'],
    webhooks: ['installation', 'installation_repositories'],
    note: 'Live: ArunKushhhh install + 81 repos via installation.created; dashboard lists repos; webhook over public tunnel' },
  { name: 'Issue Staking System', prd: '§2.2', phase: 'Backend Core', status: 'done',
    components: ['api', 'web', 'worker'], dependsOn: ['GitHub App Installations', 'Coin Economy'],
    skills: ['engineering-skills:senior-backend', 'engineering-advanced-skills:api-design-reviewer'],
    services: ['IssueService', 'StakeService'], metrics: ['pullquest_stakes_total'],
    roles: ['Contributor', 'Maintainer'],
    difficulties: ['Easy', 'Medium', 'Hard'],
    webhooks: ['issues'],
    note: 'Exact Stake-X required; treasury disable gate; Redis cache:issue + session; /issues locks exact amount' },
  { name: 'PR Lifecycle & Resolution', prd: '§2.3', phase: 'Backend Core', status: 'done',
    components: ['api', 'worker'], dependsOn: ['Issue Staking System'],
    skills: ['engineering-skills:senior-backend', 'engineering-skills:tdd-guide'],
    services: ['PRService', 'WebhookService'], metrics: ['pullquest_pr_outcomes_total'],
    roles: ['Contributor', 'Maintainer', 'Organization'],
    outcomes: ['Merged', 'Rejected', 'Multiple Accepted', 'Closed without Merge', 'Unreviewed'],
    webhooks: ['pull_request', 'pull_request_review'],
    note: 'API PRService owns all 5 outcomes; PR must mention #issue and have a LOCKED stake; Unreviewed vs Closed-without-merge split on last_review_status; Multiple Accepted splits MERGE_BONUS' },
  { name: 'XP Scoring Engine', prd: '§2.4', phase: 'Backend Core', status: 'partial',
    components: ['api', 'worker', 'shared'], dependsOn: ['PR Lifecycle & Resolution'],
    skills: ['engineering-skills:tdd-guide', 'engineering-skills:senior-backend'],
    services: ['XPService'], metrics: ['pullquest_xp_awarded_total', 'pullquest_leaderboard_update_duration_seconds'],
    roles: ['Contributor', 'Maintainer'],
    difficulties: ['Easy', 'Medium', 'Hard'],
    note: 'Formula: Cap × (Eval/5) × TrustMultiplier; trust brackets 0.5×–1.5×; no manual override' },
  { name: 'Seasonal System (Acts)', prd: '§2.5', phase: 'Backend Core', status: 'partial',
    components: ['api', 'worker', 'shared', 'database'], dependsOn: ['XP Scoring Engine', 'Coin Economy'],
    skills: ['engineering-skills:senior-backend', 'engineering-skills:tdd-guide'],
    services: ['ActService', 'XPService', 'CoinService', 'LeaderboardService'],
    metrics: ['act_reset_duration_seconds', 'users_processed_total'],
    roles: ['Contributor', 'Platform Admin'],
    note: '45-day Act; one-tier drop; XP midpoint reset; earned coin reset; purchased coins unaffected' },
  { name: 'Maintainer Evaluation', prd: '§2.4', phase: 'Backend Core', status: 'partial',
    components: ['api', 'web'], dependsOn: ['XP Scoring Engine'],
    skills: ['engineering-skills:senior-backend', 'vercel:nextjs'],
    services: ['EvaluationService', 'XPService'],
    roles: ['Maintainer'],
    note: 'Mandatory MCQ + sliders on merge; blocks XP until submitted' },
  { name: 'Tiers & Leaderboards', prd: '§2.6', phase: 'Backend Core', status: 'partial',
    components: ['api', 'web'], dependsOn: ['XP Scoring Engine', 'Seasonal System (Acts)'],
    skills: ['engineering-skills:senior-backend', 'engineering-advanced-skills:performance-profiler'],
    services: ['LeaderboardService', 'XPService'], metrics: ['pullquest_active_users', 'pullquest_leaderboard_update_duration_seconds'],
    roles: ['Contributor', 'Organization'],
    note: 'Initiator→Legend tiers; global + per-org Redis sorted sets; Unranked until first Act merge' },
  { name: 'Coin Economy', prd: '§2.7', phase: 'Backend Core', status: 'partial',
    components: ['api', 'worker'], dependsOn: ['Database Schema'],
    skills: ['engineering-skills:senior-backend', 'engineering-skills:tdd-guide'],
    services: ['CoinService'], metrics: ['pullquest_coins_minted_total'],
    roles: ['Contributor'],
    note: '150 signup verified live; 100 monthly mint; earned/purchased/locked split; bundles once per Act' },
  { name: 'Org Treasury', prd: '§2.7', phase: 'Backend Core', status: 'partial',
    components: ['api', 'worker'], dependsOn: ['Coin Economy'],
    skills: ['engineering-skills:senior-backend'],
    services: ['TreasuryService'], metrics: ['pullquest_treasury_balance'],
    roles: ['Organization'] },
  { name: 'Credibility Score', prd: '§2.9', phase: 'Backend Core', status: 'partial',
    components: ['api'], dependsOn: ['Org Treasury'],
    skills: ['engineering-skills:senior-backend'],
    services: ['CredibilityService'],
    roles: ['Contributor', 'Organization'],
    note: 'Public 0–100 score; raw treasury balance not public' },
  { name: 'Platform Admin & Moderation', prd: '§1', phase: 'Backend Core', status: 'todo',
    components: ['api', 'web'], dependsOn: ['Authentication & Identity', 'Seasonal System (Acts)', 'Coin Economy'],
    skills: ['engineering-skills:senior-backend', 'engineering-skills:security-pen-testing'],
    services: ['AuthService', 'ActService', 'CoinService', 'TreasuryService'],
    roles: ['Platform Admin'],
    note: 'One-account enforcement, moderation, economic stability monitoring, manual Act reset triggers' },
  { name: 'Rate Limiting & Middleware', prd: '§6.3', phase: 'Backend Core', status: 'done',
    components: ['api'],
    skills: ['engineering-skills:senior-backend', 'engineering-skills:security-pen-testing'],
    metrics: ['pullquest_api_requests_total', 'pullquest_api_request_duration_seconds'] },

  // Worker & Jobs
  { name: 'Webhook Processing Queue', prd: '§6.6', phase: 'Worker & Jobs', status: 'partial',
    components: ['worker', 'api'], dependsOn: ['GitHub App Installations'],
    skills: ['engineering-skills:senior-backend'],
    services: ['WebhookService'], metrics: ['pullquest_job_queue_depth'],
    note: 'HMAC + BullMQ live; installation.created persists repos; issue/PR handlers not yet verified with a real stake' },
  { name: 'Act Reset Job', prd: '§7.5', phase: 'Worker & Jobs', status: 'partial',
    components: ['worker'], dependsOn: ['Seasonal System (Acts)', 'Tiers & Leaderboards', 'Coin Economy'],
    skills: ['engineering-skills:tdd-guide', 'engineering-skills:senior-backend'],
    services: ['ActService', 'LeaderboardService'],
    metrics: ['act_reset_duration_seconds', 'users_processed_total'],
    note: '45-day cron: tier drop, XP compression, coin reset, archive' },
  { name: 'Monthly Coin Minting', prd: '§6.6', phase: 'Worker & Jobs', status: 'partial',
    components: ['worker'], dependsOn: ['Coin Economy'],
    skills: ['engineering-skills:senior-backend'],
    services: ['CoinService'], metrics: ['pullquest_coins_minted_total'] },
  { name: 'Treasury Audit Job', prd: '§6.6', phase: 'Worker & Jobs', status: 'partial',
    components: ['worker'], dependsOn: ['Org Treasury'],
    skills: ['engineering-skills:senior-backend'],
    services: ['TreasuryService'], metrics: ['pullquest_treasury_balance'] },

  // Frontend
  { name: 'Login & Auth Pages', prd: '§7.1', phase: 'Frontend', status: 'done',
    components: ['web'], dependsOn: ['Authentication & Identity'],
    skills: ['vercel:nextjs', 'supabase:supabase', 'frontend-design:frontend-design'],
    roles: ['Contributor', 'Maintainer', 'Organization'] },
  { name: 'Dashboard Page', prd: '§4.1', phase: 'Frontend', status: 'partial',
    components: ['web'],
    skills: ['vercel:nextjs', 'vercel:shadcn', 'frontend-design:frontend-design'],
    roles: ['Contributor'],
    note: 'Connect Repositories + account/repo list live; realtime and org sidebar still pending' },
  { name: 'Issues Feed', prd: '§4.1', phase: 'Frontend', status: 'partial',
    components: ['web'], dependsOn: ['Issue Staking System'],
    skills: ['vercel:nextjs', 'vercel:shadcn'],
    roles: ['Contributor'],
    note: 'Exact Stake-X CTA live; difficulty filter + search work; resolved/status filter still missing' },
  { name: 'Leaderboard Pages', prd: '§2.6', phase: 'Frontend', status: 'partial',
    components: ['web'], dependsOn: ['Tiers & Leaderboards'],
    skills: ['vercel:nextjs', 'dataviz'],
    roles: ['Contributor', 'Organization'] },
  { name: 'Contributor Profile', prd: '§2.1', phase: 'Frontend', status: 'partial',
    components: ['web'],
    skills: ['vercel:nextjs', 'vercel:shadcn'],
    roles: ['Contributor'],
    note: 'Public full contribution history (stakes, PR outcomes, XP) for transparency' },
  { name: 'Org Dashboard UI', prd: '§2.8', phase: 'Frontend', status: 'todo',
    components: ['web'], dependsOn: ['Credibility Score', 'Org Treasury'],
    skills: ['vercel:nextjs', 'dataviz', 'frontend-design:frontend-design'],
    roles: ['Organization'] },
  { name: 'Org Contributor Analytics', prd: '§2.8', phase: 'Frontend', status: 'todo',
    components: ['web'], dependsOn: ['Org Dashboard UI', 'Tiers & Leaderboards'],
    skills: ['vercel:nextjs', 'dataviz'],
    roles: ['Organization'],
    note: 'Contributor metrics and participation insights per org (PRD §10 org layer)' },
  { name: 'Coin Purchase UI', prd: '§2.7', phase: 'Frontend', status: 'todo',
    components: ['web'], dependsOn: ['Stripe Payments'],
    skills: ['vercel:nextjs', 'engineering-skills:stripe-integration-expert'],
    roles: ['Contributor'] },
  { name: 'Realtime Updates', prd: '§6.2', phase: 'Frontend', status: 'todo',
    components: ['web', 'api'], dependsOn: ['Tiers & Leaderboards'],
    skills: ['supabase:supabase', 'vercel:react-best-practices'],
    note: 'Supabase Realtime: leaderboard position, stake notifications, PR status' },

  // Integrations
  { name: 'Organization Onboarding & Trial', prd: '§4.3', phase: 'Integrations', status: 'todo',
    components: ['api', 'web'], dependsOn: ['GitHub App Installations'],
    skills: ['engineering-skills:stripe-integration-expert', 'engineering-skills:senior-backend'],
    services: ['OrgService', 'InstallationService'],
    roles: ['Organization'],
    note: 'Org admin installs GitHub App, 10-day trial, Stripe subscription post-trial (PRD §7.7)' },
  { name: 'Stripe Payments', prd: '§5', phase: 'Integrations', status: 'partial',
    components: ['api'], dependsOn: ['Coin Economy'],
    skills: ['engineering-skills:stripe-integration-expert'],
    services: ['CoinService', 'OrgService'],
    roles: ['Contributor', 'Organization'],
    note: 'Coin checkout + org subscription; webhook handler exists; flows incomplete' },
  { name: 'AI Assistance Layer', prd: '§2.10', phase: 'Integrations', status: 'partial',
    components: ['worker', 'api'], dependsOn: ['PR Lifecycle & Resolution'],
    skills: ['llm-api', 'engineering-skills:senior-backend'],
    services: ['AIService'],
    roles: ['Contributor', 'Maintainer'],
    webhooks: ['issue_comment'],
    note: 'Gemini issue/PR summaries; pullquestai bot comments; maintainer correction loop; AI never assigns XP' },
  { name: 'Repository Indexing for AI', prd: '§10', phase: 'Integrations', status: 'todo',
    components: ['worker', 'api'], dependsOn: ['AI Assistance Layer', 'GitHub App Installations'],
    skills: ['llm-api', 'engineering-skills:senior-backend'],
    services: ['AIService'],
    note: 'Repository skeletonization and indexing for AI context (PRD §10 AI layer)' },

  // Observability
  { name: 'Prometheus Metrics', prd: '§8.4', phase: 'Observability', status: 'done',
    components: ['api', 'infra'],
    skills: ['engineering-advanced-skills:observability-designer'] },
  { name: 'Grafana Dashboards', prd: '§8.5', phase: 'Observability', status: 'done',
    components: ['infra'], dependsOn: ['Prometheus Metrics'],
    skills: ['grafana-mcp:grafana-mcp-tools', 'dataviz', 'engineering-advanced-skills:observability-designer'],
    note: 'All 4 PRD dashboards provisioned (API Overview, Coin Economy, Leaderboard & XP, Worker & Queues) plus 4 alert rules; Prometheus datasource pinned uid' },
  { name: 'Sentry Integration', prd: '§8.3', phase: 'Observability', status: 'done',
    components: ['api', 'worker', 'web'],
    skills: ['sentry:sentry-instrument', 'sentry:sentry-workflow'],
    note: 'API + worker via @sentry/node (worker captures BullMQ job failures); web via @sentry/nextjs (client/server/edge configs, session replay, global error boundary, source maps pending real SENTRY_AUTH_TOKEN)' },
  { name: 'E2E Test Suite', prd: '—', phase: 'Observability', status: 'todo',
    components: ['web', 'api'],
    skills: ['pw:generate', 'pw:fix', 'gstack:/qa', 'engineering-skills:tdd-guide'] },
];

async function main() {
  const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));
  const session = driver.session();
  try {
    await session.run(
      `MERGE (p:Project {name: 'PullQuest'})
       SET p.description = 'GitHub-native seasonal reputation & incentive platform',
           p.scope = 'Full platform build — no MVP phasing (PRD §10)',
           p.prdVersion = 'Updated PRD (Supabase, GitHub App, Docker, Redis, observability stack)',
           p.seededAt = datetime()`
    );

    for (const role of USER_ROLES) {
      await session.run(
        `MERGE (r:UserRole {name: $name})
         SET r.codeName = $codeName, r.permissions = $permissions`,
        role
      );
      await session.run(
        `MATCH (p:Project {name: 'PullQuest'}), (r:UserRole {name: $name})
         MERGE (p)-[:HAS_ROLE]->(r)`,
        role
      );
    }

    for (const tier of TIERS) {
      await session.run(
        `MERGE (t:Tier {name: $name})
         SET t.order = $order,
             t.xpMin = $xpMin,
             t.xpMax = $xpMax,
             t.baseCoins = $baseCoins,
             t.note = $note`,
        {
          ...tier,
          xpMin: tier.xpMin,
          xpMax: tier.xpMax,
          baseCoins: tier.baseCoins ?? null,
          note: tier.note ?? '',
        }
      );
      await session.run(
        `MATCH (p:Project {name: 'PullQuest'}), (t:Tier {name: $name})
         MERGE (p)-[:HAS_TIER]->(t)`,
        tier
      );
    }

    for (const outcome of PR_OUTCOMES) {
      await session.run(
        `MERGE (o:PROutcome {name: $name})
         SET o.codeName = $codeName, o.resolution = $resolution`,
        outcome
      );
    }

    for (const difficulty of DIFFICULTIES) {
      await session.run(
        `MERGE (d:Difficulty {name: $name})
         SET d.codeName = $codeName,
             d.xpCap = $xpCap,
             d.stakeMin = $stakeMin,
             d.stakeMax = $stakeMax`,
        difficulty
      );
    }

    for (const rule of PRODUCT_RULES) {
      await session.run(
        `MERGE (rule:ProductRule {name: $name})
         SET rule.prd = $prd, rule.value = $value`,
        rule
      );
      await session.run(
        `MATCH (p:Project {name: 'PullQuest'}), (rule:ProductRule {name: $name})
         MERGE (p)-[:DEFINES_RULE]->(rule)`,
        rule
      );
    }

    for (const section of PRD_SECTIONS) {
      await session.run(
        `MERGE (s:PrdSection {id: $id}) SET s.title = $title`,
        section
      );
    }

    for (const wf of WORKFLOWS) {
      await session.run(
        `MERGE (w:Workflow {name: $name})
         SET w.prd = $prd, w.steps = $steps, w.primaryRole = $primaryRole`,
        wf
      );
      await session.run(
        `MATCH (p:Project {name: 'PullQuest'}), (w:Workflow {name: $name})
         MERGE (p)-[:HAS_WORKFLOW]->(w)`,
        wf
      );
    }

    for (const wh of GITHUB_WEBHOOK_EVENTS) {
      await session.run(
        `MERGE (e:WebhookEvent {event: $event})
         SET e.purpose = $purpose`,
        wh
      );
    }

    for (const tm of TRUST_MULTIPLIERS) {
      await session.run(
        `MERGE (t:TrustMultiplier {label: $label})
         SET t.minMembers = $minMembers,
             t.maxMembers = $maxMembers,
             t.minStars = $minStars,
             t.multiplier = $multiplier`,
        { ...tm, maxMembers: tm.maxMembers === Infinity ? -1 : tm.maxMembers }
      );
      await session.run(
        `MATCH (p:Project {name: 'PullQuest'}), (t:TrustMultiplier {label: $label})
         MERGE (p)-[:HAS_TRUST_MULTIPLIER]->(t)`,
        tm
      );
    }

    for (const field of INSTALLATION_FIELDS) {
      await session.run(
        `MERGE (f:InstallationField {field: $field}) SET f.description = $description`,
        field
      );
      await session.run(
        `MATCH (p:Project {name: 'PullQuest'}), (f:InstallationField {field: $field})
         MERGE (p)-[:STORES_INSTALL_FIELD]->(f)`,
        field
      );
    }

    for (const dash of GRAFANA_DASHBOARDS) {
      await session.run(
        `MERGE (d:GrafanaDashboard {name: $name}) SET d.focus = $focus`,
        dash
      );
    }

    for (const point of SENTRY_INTEGRATION_POINTS) {
      await session.run(
        `MERGE (s:SentrySurface {surface: $surface}) SET s.detail = $detail`,
        point
      );
    }

    for (const item of POST_LAUNCH_ITEMS) {
      await session.run(
        `MERGE (p:PostLaunchItem {name: $name}) SET p.prd = $prd`,
        item
      );
      await session.run(
        `MATCH (proj:Project {name: 'PullQuest'}), (p:PostLaunchItem {name: $name})
         MERGE (proj)-[:DEFERRED]->(p)`,
        item
      );
    }

    for (const alert of GRAFANA_ALERTS) {
      await session.run(
        `MERGE (a:GrafanaAlert {name: $name}) SET a.condition = $condition`,
        alert
      );
    }

    for (const ph of PHASES) {
      await session.run(
        `MATCH (p:Project {name: 'PullQuest'})
         MERGE (ph:Phase {name: $name}) SET ph.order = $order
         MERGE (p)-[:HAS_PHASE]->(ph)`,
        ph
      );
    }

    for (const c of COMPONENTS) {
      await session.run(`MERGE (c:Component {name: $name}) SET c.path = $path, c.type = $type`, c);
    }

    for (const [name, description] of Object.entries(SKILLS)) {
      await session.run(`MERGE (s:Skill {name: $name}) SET s.description = $description`, { name, description });
    }

    for (const s of SERVICES) {
      await session.run(`MERGE (svc:Service {name: $name}) SET svc.description = $description`, s);
    }

    for (const i of INFRASTRUCTURE) {
      await session.run(`MERGE (infra:Infrastructure {name: $name}) SET infra.kind = $kind, infra.detail = $detail`, i);
    }

    for (const table of DATABASE_TABLES) {
      await session.run(`MERGE (t:DatabaseTable {name: $table})`, { table });
      await session.run(
        `MATCH (c:Component {name: 'database'}), (t:DatabaseTable {name: $table})
         MERGE (c)-[:DEFINES_TABLE]->(t)`,
        { table }
      );
    }

    for (const [component, infrastructure] of Object.entries(COMPONENT_CONNECTIONS)) {
      for (const infra of infrastructure) {
        await session.run(
          `MATCH (c:Component {name: $component}), (infra:Infrastructure {name: $infra})
           MERGE (c)-[:CONNECTS_TO]->(infra)`,
          { component, infra }
        );
      }
    }

    for (const redisUseCase of REDIS_USE_CASES) {
      await session.run(
        `MERGE (r:RedisUseCase {name: $name})
         SET r.dataStructure = $dataStructure,
             r.keyPattern = $keyPattern,
             r.ttl = $ttl`,
        redisUseCase
      );
      await session.run(
        `MATCH (infra:Infrastructure {name: 'Redis'}), (r:RedisUseCase {name: $name})
         MERGE (infra)-[:SUPPORTS]->(r)`,
        redisUseCase
      );
    }

    for (const m of METRICS) {
      await session.run(`MERGE (m:Metric {name: $name}) SET m.type = $type, m.description = $description`, m);
    }

    for (const j of JOBS) {
      await session.run(
        `MERGE (j:Job {name: $name}) SET j.queue = $queue, j.trigger = $trigger`,
        j
      );
      await session.run(
        `MATCH (c:Component {name: $comp}), (j:Job {name: $name})
         MERGE (c)-[:RUNS_JOB]->(j)`,
        { comp: j.runsIn, name: j.name }
      );
    }

    for (const f of FEATURES) {
      await session.run(
        `MATCH (ph:Phase {name: $phase})
         MERGE (f:Feature {name: $name})
         SET f.prd = $prd, f.status = $status, f.note = $note
         MERGE (ph)-[:CONTAINS]->(f)`,
        { name: f.name, phase: f.phase, prd: f.prd, status: f.status, note: f.note ?? '' }
      );
      for (const comp of f.components) {
        await session.run(
          `MATCH (f:Feature {name: $name}), (c:Component {name: $comp})
           MERGE (f)-[:IMPLEMENTED_IN]->(c)`,
          { name: f.name, comp }
        );
      }
      for (const skill of f.skills) {
        await session.run(
          `MATCH (f:Feature {name: $name}), (s:Skill {name: $skill})
           MERGE (f)-[:RECOMMENDED_SKILL]->(s)`,
          { name: f.name, skill }
        );
      }
      for (const service of f.services ?? []) {
        await session.run(
          `MATCH (f:Feature {name: $name}), (svc:Service {name: $service})
           MERGE (f)-[:USES_SERVICE]->(svc)`,
          { name: f.name, service }
        );
      }
      for (const metric of f.metrics ?? []) {
        await session.run(
          `MATCH (f:Feature {name: $name}), (m:Metric {name: $metric})
           MERGE (f)-[:EMITS_METRIC]->(m)`,
          { name: f.name, metric }
        );
      }
      for (const role of f.roles ?? []) {
        await session.run(
          `MATCH (f:Feature {name: $name}), (r:UserRole {name: $role})
           MERGE (f)-[:SERVES_ROLE]->(r)`,
          { name: f.name, role }
        );
      }
      for (const outcome of f.outcomes ?? []) {
        await session.run(
          `MATCH (f:Feature {name: $name}), (o:PROutcome {name: $outcome})
           MERGE (f)-[:HANDLES_OUTCOME]->(o)`,
          { name: f.name, outcome }
        );
      }
      for (const difficulty of f.difficulties ?? []) {
        await session.run(
          `MATCH (f:Feature {name: $name}), (d:Difficulty {name: $difficulty})
           MERGE (f)-[:USES_DIFFICULTY]->(d)`,
          { name: f.name, difficulty }
        );
      }
      for (const webhook of f.webhooks ?? []) {
        await session.run(
          `MATCH (f:Feature {name: $name}), (e:WebhookEvent {event: $webhook})
           MERGE (f)-[:LISTENS_FOR]->(e)`,
          { name: f.name, webhook }
        );
      }
    }

    for (const route of ROUTES) {
      await session.run(
        `MERGE (r:Route {method: $method, path: $path})
         SET r.prd = $prd, r.purpose = $purpose`,
        route
      );
      await session.run(
        `MATCH (f:Feature {name: $feature}), (r:Route {method: $method, path: $path})
         MERGE (f)-[:EXPOSES_ROUTE]->(r)`,
        route
      );
    }

    for (const redisUseCase of REDIS_USE_CASES) {
      await session.run(
        `MATCH (f:Feature {name: $feature}), (r:RedisUseCase {name: $name})
         MERGE (f)-[:USES_REDIS]->(r)`,
        redisUseCase
      );
    }

    // DEPENDS_ON pass after all features exist
    for (const f of FEATURES) {
      for (const dep of f.dependsOn ?? []) {
        await session.run(
          `MATCH (f:Feature {name: $name}), (d:Feature {name: $dep})
           MERGE (f)-[:DEPENDS_ON]->(d)`,
          { name: f.name, dep }
        );
      }
    }

    for (const j of JOBS) {
      if (!j.implementsFeature) continue;
      await session.run(
        `MATCH (j:Job {name: $name}), (f:Feature {name: $feature})
         MERGE (j)-[:IMPLEMENTS]->(f)`,
        { name: j.name, feature: j.implementsFeature }
      );
    }

    // PRD section → feature coverage (after all features exist)
    for (const section of PRD_SECTIONS) {
      if (!section.requiredFeature) continue;
      await session.run(
        `MATCH (sec:PrdSection {id: $id}), (f:Feature {name: $requiredFeature})
         MERGE (sec)-[:REQUIRES]->(f)`,
        section
      );
    }

    for (const alert of GRAFANA_ALERTS) {
      await session.run(
        `MATCH (f:Feature {name: $feature}), (a:GrafanaAlert {name: $name})
         MERGE (f)-[:HAS_ALERT]->(a)`,
        alert
      );
    }

    for (const dash of GRAFANA_DASHBOARDS) {
      await session.run(
        `MATCH (f:Feature {name: 'Grafana Dashboards'}), (d:GrafanaDashboard {name: $name})
         MERGE (f)-[:PROVISIONS_DASHBOARD]->(d)`,
        dash
      );
    }

    for (const point of SENTRY_INTEGRATION_POINTS) {
      await session.run(
        `MATCH (f:Feature {name: 'Sentry Integration'}), (s:SentrySurface {surface: $surface})
         MERGE (f)-[:MONITORS_VIA]->(s)`,
        point
      );
    }

    for (const tm of TRUST_MULTIPLIERS) {
      await session.run(
        `MATCH (f:Feature {name: 'XP Scoring Engine'}), (t:TrustMultiplier {label: $label})
         MERGE (f)-[:APPLIES_TRUST]->(t)`,
        tm
      );
    }

    for (const field of INSTALLATION_FIELDS) {
      await session.run(
        `MATCH (f:Feature {name: 'GitHub App Installations'}), (fld:InstallationField {field: $field})
         MERGE (f)-[:PERSISTS_FIELD]->(fld)`,
        field
      );
    }

    for (const wh of GITHUB_WEBHOOK_EVENTS) {
      await session.run(
        `MATCH (f:Feature {name: $feature}), (e:WebhookEvent {event: $event})
         MERGE (f)-[:LISTENS_FOR]->(e)`,
        wh
      );
    }

    for (const step of WORKFLOW_STEPS) {
      await session.run(
        `MATCH (w:Workflow {name: $workflow}), (f:Feature {name: $feature})
         MERGE (w)-[r:STEP_OF {step: $step}]->(f)
         SET r.description = $description`,
        step
      );
    }

    const counts = await session.run(
      `MATCH (f:Feature) RETURN f.status AS status, count(*) AS n ORDER BY status`
    );
    console.log('Knowledge Graph seeded.');
    for (const r of counts.records) {
      console.log(`  ${r.get('status')}: ${r.get('n').toNumber()}`);
    }
    console.log(
      `  features: ${FEATURES.length}, skills: ${Object.keys(SKILLS).length}, phases: ${PHASES.length}, routes: ${ROUTES.length}, prdSections: ${PRD_SECTIONS.length}`
    );
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
