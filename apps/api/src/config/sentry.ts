import * as Sentry from '@sentry/node';
import { config } from './env.js';

export function initSentry() {
  if (config.SENTRY_DSN) {
    Sentry.init({
      dsn: config.SENTRY_DSN,
      environment: config.NODE_ENV,
      tracesSampleRate: 1.0,
    });
    console.log('[Sentry]: Initialized successfully.');
  } else {
    console.log('[Sentry]: SENTRY_DSN not configured. Skipping Sentry initialization.');
  }
}
export { Sentry };
