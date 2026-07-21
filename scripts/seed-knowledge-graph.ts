/**
 * Seed the PullQuest Knowledge Graph in Neo4j from the PRD.
 *
 * Graph model:
 *   (:Project)-[:HAS_PHASE]->(:Phase)-[:CONTAINS]->(:Feature)
 *   (:Feature)-[:IMPLEMENTED_IN]->(:Component)
 *   (:Feature)-[:DEPENDS_ON]->(:Feature)
 *   (:Feature)-[:RECOMMENDED_SKILL]->(:Skill)
 *
 * Feature.status: 'done' | 'partial' | 'todo' — reflects actual repo state.
 * Update statuses here (or via Neo4j Browser at :7474) as features complete,
 * then re-run: pnpm kg:seed  (idempotent — uses MERGE).
 */
import neo4j from 'neo4j-driver';

const URI = process.env.NEO4J_URI ?? 'bolt://localhost:7687';
const USER = process.env.NEO4J_USER ?? 'neo4j';
const PASSWORD = process.env.NEO4J_PASSWORD;
if (!PASSWORD) throw new Error('NEO4J_PASSWORD required (set in .env or environment)');

type Status = 'done' | 'partial' | 'todo';

interface Feature {
  name: string;
  prd: string; // PRD section reference
  phase: string;
  status: Status;
  components: string[];
  dependsOn?: string[];
  skills: string[]; // installed skill/plugin names best suited for this feature
  note?: string;
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
  'claude-api': 'LLM API reference (Gemini integration patterns)',
  'code-review:code-review': 'Diff correctness review',
  'verify': 'End-to-end change verification',
  'caveman:caveman': 'Token-compressed communication mode',
};

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
    skills: ['engineering-advanced-skills:database-designer', 'supabase:supabase-postgres-best-practices', 'supabase-mcp'] },
  { name: 'RLS Policies', prd: '§6.2', phase: 'Data Layer', status: 'done',
    components: ['database'], dependsOn: ['Database Schema'],
    skills: ['supabase:supabase', 'supabase-mcp', 'engineering-skills:security-pen-testing'] },

  // Backend Core
  { name: 'Authentication & Identity', prd: '§2.1', phase: 'Backend Core', status: 'partial',
    components: ['api', 'web'], dependsOn: ['Database Schema'],
    skills: ['supabase:supabase', 'engineering-skills:senior-backend'],
    note: 'Supabase GitHub OAuth done; GitHub App install flow partial' },
  { name: 'GitHub App Installations', prd: '§3.2', phase: 'Backend Core', status: 'partial',
    components: ['api'], dependsOn: ['Authentication & Identity'],
    skills: ['engineering-skills:senior-backend', 'engineering-skills:security-pen-testing'],
    note: 'installation.service + routes exist; webhook signature verification needs audit' },
  { name: 'Issue Staking System', prd: '§2.2', phase: 'Backend Core', status: 'partial',
    components: ['api'], dependsOn: ['GitHub App Installations', 'Coin Economy'],
    skills: ['engineering-skills:senior-backend', 'engineering-advanced-skills:api-design-reviewer'] },
  { name: 'PR Lifecycle & Resolution', prd: '§2.3', phase: 'Backend Core', status: 'partial',
    components: ['api', 'worker'], dependsOn: ['Issue Staking System'],
    skills: ['engineering-skills:senior-backend', 'engineering-skills:tdd-guide'],
    note: '5 outcomes: Merged/Rejected/Multiple/Closed/Unreviewed — resolution logic needs full test coverage' },
  { name: 'XP Scoring Engine', prd: '§2.4', phase: 'Backend Core', status: 'partial',
    components: ['api', 'worker', 'shared'], dependsOn: ['PR Lifecycle & Resolution'],
    skills: ['engineering-skills:tdd-guide', 'engineering-skills:senior-backend'],
    note: 'Formula: Cap × (Eval/5) × TrustMultiplier — pure fn in shared, tested' },
  { name: 'Maintainer Evaluation', prd: '§2.4', phase: 'Backend Core', status: 'partial',
    components: ['api', 'web'], dependsOn: ['XP Scoring Engine'],
    skills: ['engineering-skills:senior-backend', 'vercel:nextjs'] },
  { name: 'Tiers & Leaderboards', prd: '§2.6', phase: 'Backend Core', status: 'partial',
    components: ['api', 'web'], dependsOn: ['XP Scoring Engine'],
    skills: ['engineering-skills:senior-backend', 'engineering-advanced-skills:performance-profiler'],
    note: 'Redis sorted sets, global + per-org' },
  { name: 'Coin Economy', prd: '§2.7', phase: 'Backend Core', status: 'partial',
    components: ['api', 'worker'], dependsOn: ['Database Schema'],
    skills: ['engineering-skills:senior-backend', 'engineering-skills:tdd-guide'],
    note: 'earned/purchased/locked split; treasury debt ceiling −2000' },
  { name: 'Org Treasury', prd: '§2.7', phase: 'Backend Core', status: 'partial',
    components: ['api', 'worker'], dependsOn: ['Coin Economy'],
    skills: ['engineering-skills:senior-backend'] },
  { name: 'Credibility Score', prd: '§2.9', phase: 'Backend Core', status: 'partial',
    components: ['api'], dependsOn: ['Org Treasury'],
    skills: ['engineering-skills:senior-backend'] },
  { name: 'Rate Limiting & Middleware', prd: '§6.3', phase: 'Backend Core', status: 'done',
    components: ['api'],
    skills: ['engineering-skills:senior-backend', 'engineering-skills:security-pen-testing'] },

  // Worker & Jobs
  { name: 'Webhook Processing Queue', prd: '§6.6', phase: 'Worker & Jobs', status: 'partial',
    components: ['worker', 'api'], dependsOn: ['GitHub App Installations'],
    skills: ['engineering-skills:senior-backend'] },
  { name: 'Act Reset Job', prd: '§7.5', phase: 'Worker & Jobs', status: 'partial',
    components: ['worker'], dependsOn: ['Tiers & Leaderboards', 'Coin Economy'],
    skills: ['engineering-skills:tdd-guide', 'engineering-skills:senior-backend'],
    note: '45-day cron: tier drop, XP compression, coin reset, archive' },
  { name: 'Monthly Coin Minting', prd: '§6.6', phase: 'Worker & Jobs', status: 'partial',
    components: ['worker'], dependsOn: ['Coin Economy'],
    skills: ['engineering-skills:senior-backend'] },
  { name: 'Treasury Audit Job', prd: '§6.6', phase: 'Worker & Jobs', status: 'partial',
    components: ['worker'], dependsOn: ['Org Treasury'],
    skills: ['engineering-skills:senior-backend'] },

  // Frontend
  { name: 'Login & Auth Pages', prd: '§7.1', phase: 'Frontend', status: 'done',
    components: ['web'], dependsOn: ['Authentication & Identity'],
    skills: ['vercel:nextjs', 'supabase:supabase', 'frontend-design:frontend-design'] },
  { name: 'Dashboard Page', prd: '§4.1', phase: 'Frontend', status: 'partial',
    components: ['web'],
    skills: ['vercel:nextjs', 'vercel:shadcn', 'frontend-design:frontend-design'] },
  { name: 'Issues Feed', prd: '§4.1', phase: 'Frontend', status: 'partial',
    components: ['web'], dependsOn: ['Issue Staking System'],
    skills: ['vercel:nextjs', 'vercel:shadcn'] },
  { name: 'Leaderboard Pages', prd: '§2.6', phase: 'Frontend', status: 'partial',
    components: ['web'], dependsOn: ['Tiers & Leaderboards'],
    skills: ['vercel:nextjs', 'dataviz'] },
  { name: 'Contributor Profile', prd: '§2.1', phase: 'Frontend', status: 'partial',
    components: ['web'],
    skills: ['vercel:nextjs', 'vercel:shadcn'] },
  { name: 'Org Dashboard UI', prd: '§2.8', phase: 'Frontend', status: 'todo',
    components: ['web'], dependsOn: ['Credibility Score', 'Org Treasury'],
    skills: ['vercel:nextjs', 'dataviz', 'frontend-design:frontend-design'] },
  { name: 'Coin Purchase UI', prd: '§2.7', phase: 'Frontend', status: 'todo',
    components: ['web'], dependsOn: ['Stripe Payments'],
    skills: ['vercel:nextjs', 'engineering-skills:stripe-integration-expert'] },
  { name: 'Realtime Updates', prd: '§6.2', phase: 'Frontend', status: 'todo',
    components: ['web', 'api'], dependsOn: ['Tiers & Leaderboards'],
    skills: ['supabase:supabase', 'vercel:react-best-practices'] },

  // Integrations
  { name: 'Stripe Payments', prd: '§5', phase: 'Integrations', status: 'partial',
    components: ['api'], dependsOn: ['Coin Economy'],
    skills: ['engineering-skills:stripe-integration-expert'],
    note: 'Webhook + config exist; checkout session + subscription flows incomplete' },
  { name: 'AI Assistance Layer', prd: '§2.10', phase: 'Integrations', status: 'partial',
    components: ['worker', 'api'], dependsOn: ['PR Lifecycle & Resolution'],
    skills: ['claude-api', 'engineering-skills:senior-backend'],
    note: 'Gemini issue/PR summaries via aiSummary.processor; pullquestai bot comments todo' },

  // Observability
  { name: 'Prometheus Metrics', prd: '§8.4', phase: 'Observability', status: 'done',
    components: ['api', 'infra'],
    skills: ['engineering-advanced-skills:observability-designer'] },
  { name: 'Grafana Dashboards', prd: '§8.5', phase: 'Observability', status: 'partial',
    components: ['infra'], dependsOn: ['Prometheus Metrics'],
    skills: ['grafana-mcp:grafana-mcp-tools', 'dataviz', 'engineering-advanced-skills:observability-designer'] },
  { name: 'Sentry Integration', prd: '§8.3', phase: 'Observability', status: 'partial',
    components: ['api', 'worker', 'web'],
    skills: ['sentry:sentry-instrument', 'sentry:sentry-workflow'] },
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
           p.seededAt = datetime()`
    );

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

    const counts = await session.run(
      `MATCH (f:Feature) RETURN f.status AS status, count(*) AS n ORDER BY status`
    );
    console.log('Knowledge Graph seeded.');
    for (const r of counts.records) {
      console.log(`  ${r.get('status')}: ${r.get('n')}`);
    }
    console.log(`  features: ${FEATURES.length}, skills: ${Object.keys(SKILLS).length}, phases: ${PHASES.length}`);
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
