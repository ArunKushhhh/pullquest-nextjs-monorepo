import * as Sentry from '@sentry/node';
import { config } from './env.js';

export function initSentry() {
  if (config.SENTRY_DSN) {
    Sentry.init({
      dsn: config.SENTRY_DSN,
      environment: config.NODE_ENV,
      tracesSampleRate: 1.0,
    });
    console.log('[Worker Sentry]: Initialized successfully.');
  } else {
    console.log('[Worker Sentry]: NEXT_PUBLIC_SENTRY_DSN not configured. Skipping Sentry initialization.');
  }
}
export { Sentry };
