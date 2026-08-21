import { Router } from 'express';
import { UserRole } from '@pullquest/shared';
import { authMiddleware } from '../middleware/auth.js';
import { config } from '../config/env.js';
import {
  enqueueActReset,
  getCurrentAct,
  toActCurrentView,
} from '../services/act.service.js';

const router = Router();

router.get('/current', async (_req, res, next) => {
  try {
    const act = await getCurrentAct();
    if (!act) {
      res.status(404).json({ error: 'NotFound', message: 'No active seasonal Act found' });
      return;
    }
    res.json(toActCurrentView(act));
  } catch (err) {
    next(err);
  }
});

router.post('/reset', authMiddleware, async (req, res, next) => {
  try {
    const isDev = config.NODE_ENV !== 'production';
    const isAdmin = req.user?.role === UserRole.PLATFORM_ADMIN;
    if (!isDev && !isAdmin) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Manual Act reset requires platform admin',
      });
      return;
    }

    const jobId = await enqueueActReset(true);
    res.status(202).json({ queued: true, jobId });
  } catch (err) {
    next(err);
  }
});

export default router;
