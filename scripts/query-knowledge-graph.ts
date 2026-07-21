/**
 * Query the PullQuest Knowledge Graph.
 *
 * Usage:
 *   pnpm kg:query            — full project summary
 *   pnpm kg:query status     — completion % by phase
 *   pnpm kg:query todo       — incomplete features with recommended skills
 *   pnpm kg:query skills "Feature Name"  — recommended skills for a feature
 *   pnpm kg:query deps "Feature Name"    — what a feature depends on / blocks
 */
import neo4j from 'neo4j-driver';

const URI = process.env.NEO4J_URI ?? 'bolt://localhost:7687';
const USER = process.env.NEO4J_USER ?? 'neo4j';
const PASSWORD = process.env.NEO4J_PASSWORD ?? 'pullquest123';

const [, , command, arg] = process.argv;

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
        if (!res.records.length) { console.log(`No feature matching "${arg}"`); break; }
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
        const pct = Math.round(((done + partial * 0.5) / total) * 100);
        console.log(`PullQuest — ${pct}% complete`);
        console.log(`  done: ${done}  partial: ${partial}  todo: ${t.get('todo').toNumber()}  total: ${total}`);
        console.log(`\nCommands: status | todo | skills "<name>" | deps "<name>"`);
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
