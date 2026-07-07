import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getUserStakes } from '../services/stake.service.js';

const router = Router();

router.get('/mine', authMiddleware, async (req, res, next) => {
  try {
    const stakes = await getUserStakes(req.user!.id);
    res.json(stakes);
  } catch (err) {
    next(err);
  }
});

export default router;
