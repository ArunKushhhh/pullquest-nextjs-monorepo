/**
 * Query the PullQuest Knowledge Graph.
 *
 * Usage:
 *   pnpm kg:query              — full project summary
 *   pnpm kg:query status       — completion % by phase
 *   pnpm kg:query todo         — incomplete features with recommended skills
 *   pnpm kg:query skills "Feature Name"  — recommended skills for a feature
 *   pnpm kg:query deps "Feature Name"    — dependency chain and blockers
 *   pnpm kg:query routes       — PRD API route coverage (§6.3)
 *   pnpm kg:query infra        — infrastructure, Redis, and database coverage
 *   pnpm kg:query coverage     — PRD section → feature mapping audit
 *   pnpm kg:query roles        — user roles and served features (§1)
 *   pnpm kg:query economy      — tiers, difficulties, outcomes, product rules
 *   pnpm kg:query workflows    — PRD §4 workflow steps → features
 *   pnpm kg:query services     — PRD §6.4 service layer → features
 */
import neo4j from 'neo4j-driver';
import { getNeo4jConfig } from './kg-config';

const { uri: URI, user: USER, password: PASSWORD } = getNeo4jConfig();

const [, , command, arg] = process.argv;

const HELP =
  'Commands: status | todo | skills "<name>" | deps "<name>" | routes | infra | coverage | roles | economy | workflows | services';

async function main() {
  const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));
  const session = driver.session();
  try {
    switch (command) {
      case 'status': {
        const res = await session.run(
          `MATCH (ph:Phase)-[:CONTAINS]->(f:Feature)
           WITH ph, count(f) AS total,
                sum(CASE f.status WHEN 'done' THEN 1 ELSE 0 END) AS done,
                sum(CASE f.status WHEN 'partial' THEN 1 ELSE 0 END) AS partial
           RETURN ph.name AS phase, ph.order AS ord, total, done, partial
           ORDER BY ph.order`
        );
        console.log('Phase completion (done / partial / total):');
        for (const r of res.records) {
          const total = r.get('total').toNumber();
          const done = r.get('done').toNumber();
          const partial = r.get('partial').toNumber();
          const pct = Math.round(((done + partial * 0.5) / total) * 100);
          console.log(`  ${String(pct).padStart(3)}%  ${r.get('phase')}: ${done}/${partial}/${total}`);
        }
        break;
      }
      case 'todo': {
        const res = await session.run(
          `MATCH (f:Feature) WHERE f.status <> 'done'
           OPTIONAL MATCH (f)-[:RECOMMENDED_SKILL]->(s:Skill)
           OPTIONAL MATCH (f)-[:DEPENDS_ON]->(d:Feature) WHERE d.status <> 'done'
           RETURN f.name AS name, f.status AS status, f.prd AS prd, f.note AS note,
                  collect(DISTINCT s.name) AS skills, collect(DISTINCT d.name) AS blockedBy
           ORDER BY f.status DESC, f.name`
        );
        console.log('Incomplete features:');
        for (const r of res.records) {
          console.log(`\n  [${r.get('status')}] ${r.get('name')} (PRD ${r.get('prd')})`);
          if (r.get('note')) console.log(`    note: ${r.get('note')}`);
          const blocked = r.get('blockedBy').filter(Boolean);
          if (blocked.length) console.log(`    blocked by: ${blocked.join(', ')}`);
          const skills = r.get('skills').filter(Boolean);
          if (skills.length) console.log(`    skills: ${skills.join(', ')}`);
        }
        break;
      }
      case 'skills': {
        if (!arg) throw new Error('Usage: pnpm kg:query skills "Feature Name"');
        const res = await session.run(
          `MATCH (f:Feature) WHERE toLower(f.name) CONTAINS toLower($arg)
           OPTIONAL MATCH (f)-[:RECOMMENDED_SKILL]->(s:Skill)
           RETURN f.name AS feature, f.status AS status,
                  collect(s.name + ' — ' + s.description) AS skills`,
          { arg }
        );
        if (!res.records.length) {
          console.log(`No feature matching "${arg}"`);
          break;
        }
        for (const r of res.records) {
          console.log(`${r.get('feature')} [${r.get('status')}]`);
          for (const s of r.get('skills').filter(Boolean)) console.log(`  - ${s}`);
        }
        break;
      }
      case 'deps': {
        if (!arg) throw new Error('Usage: pnpm kg:query deps "Feature Name"');
        const res = await session.run(
          `MATCH (f:Feature) WHERE toLower(f.name) CONTAINS toLower($arg)
           OPTIONAL MATCH (f)-[:DEPENDS_ON]->(up:Feature)
           OPTIONAL MATCH (down:Feature)-[:DEPENDS_ON]->(f)
           RETURN f.name AS feature, f.status AS status,
                  collect(DISTINCT up.name + ' [' + up.status + ']') AS dependsOn,
                  collect(DISTINCT down.name + ' [' + down.status + ']') AS blocks`,
          { arg }
        );
        for (const r of res.records) {
          console.log(`${r.get('feature')} [${r.get('status')}]`);
          console.log(`  depends on: ${r.get('dependsOn').filter(Boolean).join(', ') || '—'}`);
          console.log(`  blocks: ${r.get('blocks').filter(Boolean).join(', ') || '—'}`);
        }
        break;
      }
      case 'routes': {
        const res = await session.run(
          `MATCH (f:Feature)-[:EXPOSES_ROUTE]->(r:Route)
           RETURN f.name AS feature, r.method AS method, r.path AS path, r.prd AS prd, r.purpose AS purpose
           ORDER BY r.path, r.method`
        );
        console.log('PRD API routes (§6.3):');
        for (const r of res.records) {
          console.log(`  ${r.get('method')} ${r.get('path')} (${r.get('prd')})`);
          console.log(`    feature: ${r.get('feature')}`);
          console.log(`    purpose: ${r.get('purpose')}`);
        }
        break;
      }
      case 'infra': {
        const infra = await session.run(
          `MATCH (c:Component)-[:CONNECTS_TO]->(i:Infrastructure)
           RETURN c.name AS component, collect(i.name) AS infrastructure
           ORDER BY c.name`
        );
        console.log('Component infrastructure:');
        for (const r of infra.records) {
          console.log(`  ${r.get('component')}: ${r.get('infrastructure').join(', ') || '—'}`);
        }

        const redis = await session.run(
          `MATCH (f:Feature)-[:USES_REDIS]->(r:RedisUseCase)
           RETURN r.name AS name, r.dataStructure AS structure, r.keyPattern AS keyPattern,
                  r.ttl AS ttl, f.name AS feature
           ORDER BY r.name`
        );
        console.log('\nRedis usage (§6.5 / §8.2):');
        for (const r of redis.records) {
          console.log(
            `  ${r.get('name')}: ${r.get('structure')} ${r.get('keyPattern')} TTL=${r.get('ttl')} (${r.get('feature')})`
          );
        }

        const tables = await session.run(
          `MATCH (:Component {name: 'database'})-[:DEFINES_TABLE]->(t:DatabaseTable)
           RETURN collect(t.name) AS tables`
        );
        console.log(`\nDatabase tables (§6.2): ${tables.records[0].get('tables').sort().join(', ')}`);

        const jobs = await session.run(
          `MATCH (c:Component)-[:RUNS_JOB]->(j:Job)
           OPTIONAL MATCH (j)-[:IMPLEMENTS]->(f:Feature)
           RETURN j.name AS job, j.queue AS queue, j.trigger AS trigger, c.name AS runsIn,
                  f.name AS feature
           ORDER BY j.queue, j.name`
        );
        console.log('\nBullMQ jobs (§6.6):');
        for (const r of jobs.records) {
          console.log(
            `  ${r.get('job')} [${r.get('queue')}] @ ${r.get('runsIn')} → ${r.get('feature') ?? '—'}`
          );
          console.log(`    trigger: ${r.get('trigger')}`);
        }
        break;
      }
      case 'coverage': {
        const res = await session.run(
          `MATCH (s:PrdSection)
           OPTIONAL MATCH (s)-[:REQUIRES]->(f:Feature)
           RETURN s.id AS id, s.title AS title, f.name AS feature, f.status AS status
           ORDER BY s.id`
        );
        console.log('PRD section coverage:');
        for (const r of res.records) {
          const feature = r.get('feature');
          const status = r.get('status');
          const mapped = feature ? `${feature} [${status}]` : '— unmapped —';
          console.log(`  ${r.get('id')} ${r.get('title')}`);
          console.log(`    → ${mapped}`);
        }

        const deferred = await session.run(
          `MATCH (p:Project {name: 'PullQuest'})-[:DEFERRED]->(d:PostLaunchItem)
           RETURN collect(d.name) AS items`
        );
        const items = deferred.records[0]?.get('items') ?? [];
        if (items.length) {
          console.log('\nPost-launch (§10, excluded from build):');
          for (const item of items) console.log(`  - ${item}`);
        }
        break;
      }
      case 'roles': {
        const res = await session.run(
          `MATCH (p:Project {name: 'PullQuest'})-[:HAS_ROLE]->(r:UserRole)
           OPTIONAL MATCH (f:Feature)-[:SERVES_ROLE]->(r)
           RETURN r.name AS role, r.permissions AS permissions,
                  collect(DISTINCT f.name + ' [' + f.status + ']') AS features
           ORDER BY r.name`
        );
        console.log('User roles (§1):');
        for (const r of res.records) {
          console.log(`\n  ${r.get('role')}`);
          console.log(`    permissions: ${r.get('permissions')}`);
          const features = r.get('features').filter(Boolean);
          if (features.length) console.log(`    features: ${features.join(', ')}`);
        }
        break;
      }
      case 'economy': {
        const rules = await session.run(
          `MATCH (p:Project {name: 'PullQuest'})-[:DEFINES_RULE]->(rule:ProductRule)
           RETURN rule.name AS name, rule.prd AS prd, rule.value AS value
           ORDER BY rule.prd, rule.name`
        );
        console.log('Product rules:');
        for (const r of rules.records) {
          console.log(`  [${r.get('prd')}] ${r.get('name')}: ${r.get('value')}`);
        }

        const tiers = await session.run(
          `MATCH (p:Project {name: 'PullQuest'})-[:HAS_TIER]->(t:Tier)
           RETURN t.name AS name, t.xpMin AS xpMin, t.xpMax AS xpMax, t.baseCoins AS baseCoins, t.note AS note
           ORDER BY t.order`
        );
        console.log('\nTiers (§2.6):');
        for (const r of tiers.records) {
          const xpMin = r.get('xpMin');
          const xpMax = r.get('xpMax');
          const range =
            xpMin === null && xpMax === null
              ? 'Act start state'
              : `${xpMin ?? 0}–${xpMax ?? '∞'} XP`;
          const coins = r.get('baseCoins');
          console.log(
            `  ${r.get('name')}: ${range}${coins != null ? `, base ${coins} coins` : ''}${r.get('note') ? ` (${r.get('note')})` : ''}`
          );
        }

        const diffs = await session.run(
          `MATCH (d:Difficulty)
           RETURN d.name AS name, d.xpCap AS xpCap, d.stakeMin AS stakeMin, d.stakeMax AS stakeMax
           ORDER BY d.stakeMin`
        );
        console.log('\nDifficulty bands (§2.2 / §2.4):');
        for (const r of diffs.records) {
          console.log(
            `  ${r.get('name')}: XP cap ${r.get('xpCap')}, stake ${r.get('stakeMin')}–${r.get('stakeMax')}`
          );
        }

        const trust = await session.run(
          `MATCH (p:Project {name: 'PullQuest'})-[:HAS_TRUST_MULTIPLIER]->(t:TrustMultiplier)
           RETURN t.label AS label, t.multiplier AS multiplier
           ORDER BY t.multiplier`
        );
        console.log('\nTrust multipliers (§2.4):');
        for (const r of trust.records) {
          console.log(`  ${r.get('label')}: ${r.get('multiplier')}×`);
        }

        const outcomes = await session.run(
          `MATCH (o:PROutcome)
           RETURN o.name AS name, o.resolution AS resolution
           ORDER BY o.name`
        );
        console.log('\nPR outcomes (§2.3):');
        for (const r of outcomes.records) {
          console.log(`  ${r.get('name')}: ${r.get('resolution')}`);
        }
        break;
      }
      case 'workflows': {
        const res = await session.run(
          `MATCH (p:Project {name: 'PullQuest'})-[:HAS_WORKFLOW]->(w:Workflow)
           OPTIONAL MATCH (w)-[s:STEP_OF]->(f:Feature)
           RETURN w.name AS workflow, w.prd AS prd, w.primaryRole AS role,
                  s.step AS step, s.description AS description, f.name AS feature, f.status AS status
           ORDER BY w.name, s.step`
        );
        let current = '';
        for (const r of res.records) {
          const wf = r.get('workflow');
          if (wf !== current) {
            current = wf;
            console.log(`\n${wf} (${r.get('prd')}) — ${r.get('role')}`);
          }
          const step = r.get('step');
          if (step != null) {
            console.log(
              `  ${step}. ${r.get('description')} → ${r.get('feature')} [${r.get('status')}]`
            );
          }
        }
        break;
      }
      case 'services': {
        const res = await session.run(
          `MATCH (svc:Service)
           OPTIONAL MATCH (f:Feature)-[:USES_SERVICE]->(svc)
           RETURN svc.name AS service, svc.description AS description,
                  collect(DISTINCT f.name + ' [' + f.status + ']') AS features
           ORDER BY svc.name`
        );
        console.log('Service layer (§6.4):');
        for (const r of res.records) {
          console.log(`\n  ${r.get('service')}`);
          console.log(`    ${r.get('description')}`);
          const features = r.get('features').filter(Boolean);
          if (features.length) console.log(`    used by: ${features.join(', ')}`);
          else console.log('    used by: —');
        }
        break;
      }
      default: {
        const totals = await session.run(
          `MATCH (f:Feature)
           RETURN count(f) AS total,
                  sum(CASE f.status WHEN 'done' THEN 1 ELSE 0 END) AS done,
                  sum(CASE f.status WHEN 'partial' THEN 1 ELSE 0 END) AS partial,
                  sum(CASE f.status WHEN 'todo' THEN 1 ELSE 0 END) AS todo`
        );
        const t = totals.records[0];
        const total = t.get('total').toNumber();
        const done = t.get('done').toNumber();
        const partial = t.get('partial').toNumber();
        const pct = total ? Math.round(((done + partial * 0.5) / total) * 100) : 0;

        const meta = await session.run(
          `MATCH (p:Project {name: 'PullQuest'})
           OPTIONAL MATCH (ph:Phase) WITH p, count(ph) AS phases
           OPTIONAL MATCH (s:PrdSection) WITH p, phases, count(s) AS sections
           OPTIONAL MATCH (svc:Service) WITH p, phases, sections, count(svc) AS services
           OPTIONAL MATCH (r:Route) WITH p, phases, sections, services, count(r) AS routes
           RETURN p.description AS description, p.scope AS scope, phases, sections, services, routes`
        );
        const m = meta.records[0];

        console.log(`PullQuest — ${pct}% complete`);
        console.log(`  done: ${done}  partial: ${partial}  todo: ${t.get('todo').toNumber()}  total: ${total}`);
        if (m) {
          console.log(`\n${m.get('description')}`);
          console.log(`  scope: ${m.get('scope')}`);
          console.log(
            `  graph: ${m.get('phases').toNumber()} phases, ${m.get('sections').toNumber()} PRD sections, ${m.get('services').toNumber()} services, ${m.get('routes').toNumber()} routes`
          );
        }
        console.log(`\n${HELP}`);
      }
    }
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((err) => {
  console.error('Query failed:', err.message);
  process.exit(1);
});
