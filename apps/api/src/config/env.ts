import dotenv from 'dotenv';
import path from 'path';

// Load env files
dotenv.config();

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
  SUPABASE_URL: getEnv('SUPABASE_URL', true, 'https://placeholder.supabase.co'),
  SUPABASE_ANON_KEY: getEnv('SUPABASE_ANON_KEY', true, 'placeholder-anon-key'),
  SUPABASE_SERVICE_ROLE_KEY: getEnv('SUPABASE_SERVICE_ROLE_KEY', true, 'placeholder-service-role-key'),
  REDIS_URL: getEnv('REDIS_URL', false, 'redis://localhost:6379'),
  GITHUB_APP_ID: getEnv('GITHUB_APP_ID', true, '12345'),
  GITHUB_WEBHOOK_SECRET: getEnv('GITHUB_WEBHOOK_SECRET', true, 'placeholder-webhook-secret'),
  STRIPE_SECRET_KEY: getEnv('STRIPE_SECRET_KEY', true, 'sk_test_placeholder'),
  STRIPE_WEBHOOK_SECRET: getEnv('STRIPE_WEBHOOK_SECRET', true, 'whsec_placeholder'),
  GEMINI_API_KEY: getEnv('GEMINI_API_KEY', false),
  SENTRY_DSN: getEnv('SENTRY_DSN', false),
};
