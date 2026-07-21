/**
 * Wipe the PullQuest Knowledge Graph (all nodes + relationships).
 * Usage: pnpm kg:reset
 */
import neo4j from 'neo4j-driver';

const URI = process.env.NEO4J_URI ?? 'bolt://localhost:7687';
const USER = process.env.NEO4J_USER ?? 'neo4j';
const PASSWORD = process.env.NEO4J_PASSWORD ?? 'pullquest123';

async function main() {
  const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));
  const session = driver.session();
  try {
    const res = await session.run('MATCH (n) DETACH DELETE n RETURN count(n) AS deleted');
    console.log(`Graph wiped. Re-seed with: pnpm kg:seed`);
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((err) => {
  console.error('Reset failed:', err.message);
  process.exit(1);
});
