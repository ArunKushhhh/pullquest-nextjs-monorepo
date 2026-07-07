import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getInstallationStatus } from '../services/installation.service.js';

const router = Router();

router.get('/status', authMiddleware, async (req, res, next) => {
  try {
    const status = await getInstallationStatus(req.user!.id);
    res.json({ installations: status });
  } catch (err) {
    next(err);
  }
});

export default router;
