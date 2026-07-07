import dotenv from 'dotenv';

dotenv.config();

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
  SUPABASE_URL: getEnv('SUPABASE_URL', true, 'https://placeholder.supabase.co'),
  SUPABASE_SERVICE_ROLE_KEY: getEnv('SUPABASE_SERVICE_ROLE_KEY', true, 'placeholder-service-role-key'),
  SENTRY_DSN: getEnv('SENTRY_DSN', false),
  GEMINI_API_KEY: getEnv('GEMINI_API_KEY', false),
  GITHUB_APP_ID: getEnv('GITHUB_APP_ID', false, '12345'),
  GITHUB_APP_PRIVATE_KEY: getEnv('GITHUB_APP_PRIVATE_KEY', false, 'placeholder-private-key'),
  NODE_ENV: getEnv('NODE_ENV', false, 'development'),
};
