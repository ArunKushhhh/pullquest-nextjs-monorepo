import { Router } from 'express';
import { APP_NAME } from '@pullquest/shared';

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: APP_NAME,
    timestamp: new Date().toISOString(),
  });
});

export default router;
