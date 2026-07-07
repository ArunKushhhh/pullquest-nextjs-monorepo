import { Router, Request, Response, NextFunction } from 'express';
import { verifyGitHubSignature, handleGitHubEvent } from '../services/webhook.service.js';
import { config } from '../config/env.js';

const router = Router();

// Use express.raw({ type: 'application/json' }) middleware in index.ts for this path
router.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const signature = req.headers['x-hub-signature-256'] as string;
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf-8') : req.body;

  if (!verifyGitHubSignature(rawBody, signature, config.GITHUB_WEBHOOK_SECRET)) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid GitHub HMAC signature',
      statusCode: 401,
    });
    return;
  }

  const event = req.headers['x-github-event'] as string;
  const payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;

  try {
    // Process asynchronously so we acknowledge GitHub's payload immediately within their timeout
    handleGitHubEvent(event, payload).catch((err) => {
      console.error('[GitHub Webhook Async Error]:', err);
    });

    res.status(202).json({ accepted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
