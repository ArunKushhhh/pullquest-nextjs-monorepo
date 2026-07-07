import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getUserById, getOrCreateUser } from '../services/auth.service.js';

const router = Router();

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const user = await getUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'NotFound', message: 'User not found' });
      return;
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.post('/callback', authMiddleware, async (req, res, next) => {
  try {
    const { github_id, github_username } = req.user!;
    if (!github_id || !github_username) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'Missing GitHub credentials in Authorization token metadata',
      });
      return;
    }

    const user = await getOrCreateUser(
      github_id,
      github_username,
      null, // Email (can enrich later)
      null  // Avatar URL (can enrich later)
    );

    res.json(user);
  } catch (err) {
    next(err);
  }
});

export default router;
