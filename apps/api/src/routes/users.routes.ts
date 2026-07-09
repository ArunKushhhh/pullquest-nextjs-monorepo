import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getUserProfile, getUserPRHistory, getUserStakeHistory } from '../services/user.service.js';

const router = Router();

// 1. Public Profile
router.get('/:userId/profile', async (req, res, next) => {
  try {
    const profile = await getUserProfile(req.params.userId);
    if (!profile) {
      res.status(404).json({ error: 'NotFound', message: 'User not found' });
      return;
    }
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

// 2. Public PR History
router.get('/:userId/history', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '10', 10);

    const history = await getUserPRHistory(req.params.userId, page, limit);
    res.json(history);
  } catch (err) {
    next(err);
  }
});

// 3. User Staking History (Protected)
router.get('/:userId/stakes', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.params.userId;
    if (req.user!.id !== userId) {
      res.status(403).json({ error: 'Forbidden', message: 'You can only view your own stakes' });
      return;
    }

    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '10', 10);

    const stakes = await getUserStakeHistory(userId, page, limit);
    res.json(stakes);
  } catch (err) {
    next(err);
  }
});

export default router;
