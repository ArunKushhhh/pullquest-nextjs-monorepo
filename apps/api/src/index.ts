import 'dotenv/config';
import { initSentry, Sentry } from './config/sentry.js';

// Initialize Sentry first before loading any controllers/routes
initSentry();

import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { redis } from './config/redis.js';

// Middlewares
import { rateLimiter } from './middleware/rateLimiter.js';
import { metricsMiddleware } from './middleware/metrics.js';
import { errorHandler } from './middleware/errorHandler.js';

// Route Groups
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import issuesRoutes from './routes/issues.routes.js';
import stakesRoutes from './routes/stakes.routes.js';
import prsRoutes from './routes/prs.routes.js';
import leaderboardRoutes from './routes/leaderboard.routes.js';
import coinsRoutes from './routes/coins.routes.js';
import orgsRoutes from './routes/orgs.routes.js';
import installationsRoutes from './routes/installations.routes.js';
import actsRoutes from './routes/acts.routes.js';
import metricsRoutes from './routes/metrics.routes.js';
import usersRoutes from './routes/users.routes.js';

// Webhooks
import githubWebhook from './webhooks/github.webhook.js';
import stripeWebhook from './webhooks/stripe.webhook.js';

const app = express();
const port = config.PORT;

// Enable CORS
app.use(cors({ origin: '*' }));

// Request rate limiting
app.use(rateLimiter);

// Observe Prometheus HTTP metrics
app.use(metricsMiddleware);

// Webhooks require raw body parsing for signature validation
app.use(
  '/api/webhooks/github',
  express.raw({ type: 'application/json' }),
  githubWebhook
);
app.use(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhook
);

// Standard JSON parser for other endpoints
app.use(express.json());

// Register API Routes
app.use('/', healthRoutes); // GET /health
app.use('/api/auth', authRoutes);
app.use('/api/issues', issuesRoutes);
app.use('/api/stakes', stakesRoutes);
app.use('/api/prs', prsRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/coins', coinsRoutes);
app.use('/api/orgs', orgsRoutes);
app.use('/api/installations', installationsRoutes);
app.use('/api/acts', actsRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/users', usersRoutes);

// Sentry Error Handler (must be registered before any other error middlewares)
if (config.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// Global Exception Handler
app.use(errorHandler);

const server = app.listen(port, () => {
  console.log(`[server]: API Server is running at http://localhost:${port}`);
  console.log(`[server]: Environment: ${config.NODE_ENV}`);
});

// Graceful Shutdown
const shutdown = () => {
  console.log('[server]: Shutting down API server gracefully...');
  server.close(async () => {
    console.log('[server]: HTTP server closed.');
    try {
      await redis.quit();
      console.log('[server]: Redis client connection closed.');
    } catch (err) {
      console.error('[server]: Error quitting Redis:', err);
    }
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
export default app;
