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
      console.warn(`[WARNING]: Environment variable ${key} is not set.`);
      return defaultValue;
    }
    return defaultValue;
  }
  return value;
}

export const config = {
  REDIS_URL: getEnv('REDIS_URL', false, 'redis://localhost:6379'),
  // NEXT_PUBLIC_* names are canonical: the web app needs the prefix for browser
  // inlining, and the server reads the same vars to avoid duplicate entries.
  SUPABASE_URL: getEnv('NEXT_PUBLIC_SUPABASE_URL', true, 'https://placeholder.supabase.co'),
  SUPABASE_SERVICE_ROLE_KEY: getEnv('SUPABASE_SERVICE_ROLE_KEY', true, 'placeholder-service-role-key'),
  SENTRY_DSN: getEnv('NEXT_PUBLIC_SENTRY_DSN', false),
  GEMINI_API_KEY: getEnv('GEMINI_API_KEY', false),
  GITHUB_APP_ID: getEnv('GITHUB_APP_ID', false, '12345'),
  GITHUB_APP_PRIVATE_KEY: getEnv('GITHUB_APP_PRIVATE_KEY', false, 'placeholder-private-key'),
  NODE_ENV: getEnv('NODE_ENV', false, 'development'),
};
