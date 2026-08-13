// @pullquest/database — Barrel exports
export { createSupabaseClient, createSupabaseAdmin } from './client.js';
export type { TypedSupabaseClient } from './client.js';
export type {
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
  Json,
} from './types/database.types.js';
