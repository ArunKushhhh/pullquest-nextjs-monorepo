import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface Neo4jConfig {
  uri: string;
  user: string;
  password: string;
}

export function loadDotEnv(path = resolve(process.cwd(), '.env')) {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match) continue;

    const [, key, rawValue = ''] = match;
    if (process.env[key] !== undefined) continue;

    const value = rawValue
      .replace(/\s+#.*$/, '')
      .replace(/^(['"])(.*)\1$/, '$2');
    process.env[key] = value;
  }
}

export function getNeo4jConfig(): Neo4jConfig {
  loadDotEnv();

  const uri = process.env.NEO4J_URI ?? 'bolt://localhost:7687';
  const user = process.env.NEO4J_USER ?? 'neo4j';
  const password = process.env.NEO4J_PASSWORD;

  if (!password) {
    throw new Error('NEO4J_PASSWORD required (set in .env or environment)');
  }

  return { uri, user, password };
}
