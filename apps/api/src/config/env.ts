import dotenv from 'dotenv';
import path from 'path';

// Load app-local .env first (if any), then fall back to the monorepo root
// .env — the single source of truth. dotenv never overrides vars already set.
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

function getEnv(key: string, required = true, defaultValue = ''): string {
  const value = process.env[key];
  if (!value) {
    if (required) {
      // In development, we can print a warning instead of failing immediately to make it easier to set up
      console.warn(`[WARNING]: Environment variable ${key} is not set.`);
      return defaultValue;
    }
    return defaultValue;
  }
  return value;
}

export const config = {
  PORT: parseInt(getEnv('PORT', false, '3001'), 10),
  NODE_ENV: getEnv('NODE_ENV', false, 'development'),
  // NEXT_PUBLIC_* names are canonical: the web app needs the prefix for browser
  // inlining, and the server reads the same vars to avoid duplicate entries.
  SUPABASE_URL: getEnv('NEXT_PUBLIC_SUPABASE_URL', true, 'https://placeholder.supabase.co'),
  SUPABASE_ANON_KEY: getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', true, 'placeholder-anon-key'),
  SUPABASE_SERVICE_ROLE_KEY: getEnv('SUPABASE_SERVICE_ROLE_KEY', true, 'placeholder-service-role-key'),
  REDIS_URL: getEnv('REDIS_URL', false, 'redis://localhost:6379'),
  LEADERBOARD_CACHE_TTL_SECONDS: parseInt(
    getEnv('LEADERBOARD_CACHE_TTL_SECONDS', false, '15'),
    10
  ),
  GITHUB_APP_ID: getEnv('GITHUB_APP_ID', true, '12345'),
  GITHUB_WEBHOOK_SECRET: getEnv('GITHUB_WEBHOOK_SECRET', true, 'placeholder-webhook-secret'),
  STRIPE_SECRET_KEY: getEnv('STRIPE_SECRET_KEY', true, 'sk_test_placeholder'),
  STRIPE_WEBHOOK_SECRET: getEnv('STRIPE_WEBHOOK_SECRET', true, 'whsec_placeholder'),
  GEMINI_API_KEY: getEnv('GEMINI_API_KEY', false),
  SENTRY_DSN: getEnv('NEXT_PUBLIC_SENTRY_DSN', false),
};
