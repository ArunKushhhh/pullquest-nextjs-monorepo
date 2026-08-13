import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types/database.types.js';

export type TypedSupabaseClient = SupabaseClient<Database>;

let supabaseClient: TypedSupabaseClient | null = null;
let supabaseAdmin: TypedSupabaseClient | null = null;

/**
 * Create a Supabase client using the anon key.
 * Used for user-scoped queries (respects RLS).
 */
export function createSupabaseClient(): TypedSupabaseClient {
  if (supabaseClient) return supabaseClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables'
    );
  }

  supabaseClient = createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}

/**
 * Create a Supabase admin client using the service role key.
 * Used for server-side admin operations (bypasses RLS).
 *
 * IMPORTANT: Never expose this client to the frontend.
 */
export function createSupabaseAdmin(): TypedSupabaseClient {
  if (supabaseAdmin) return supabaseAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
    );
  }

  supabaseAdmin = createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdmin;
}
