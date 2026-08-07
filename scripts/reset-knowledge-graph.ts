/**
 * Wipe the PullQuest Knowledge Graph (all nodes + relationships).
 * Usage: pnpm kg:reset
 */
import neo4j from 'neo4j-driver';
import { getNeo4jConfig } from './kg-config';

const { uri: URI, user: USER, password: PASSWORD } = getNeo4jConfig();

async function main() {
  const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));
  const session = driver.session();
  try {
    const count = await session.run('MATCH (n) RETURN count(n) AS total');
    const deleted = count.records[0].get('total').toNumber();
    await session.run('MATCH (n) DETACH DELETE n');
    console.log(`Graph wiped (${deleted} nodes). Re-seed with: pnpm kg:seed`);
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((err) => {
  console.error('Reset failed:', err.message);
  process.exit(1);
});
