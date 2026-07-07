import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getUserBalance, purchaseCoins } from '../services/coin.service.js';

const router = Router();

router.get('/balance', authMiddleware, async (req, res, next) => {
  try {
    const balance = await getUserBalance(req.user!.id);
    res.json(balance);
  } catch (err) {
    next(err);
  }
});

router.post('/purchase', authMiddleware, async (req, res, next) => {
  try {
    const { bundle_id } = req.body;
    const userId = req.user!.id;

    if (!bundle_id) {
      res.status(400).json({ error: 'BadRequest', message: 'Missing bundle_id' });
      return;
    }

    // Map test bundles
    let coinsToAdd = 0;
    if (bundle_id === 'coins_100') coinsToAdd = 100;
    else if (bundle_id === 'coins_500') coinsToAdd = 500;
    else if (bundle_id === 'coins_1000') coinsToAdd = 1000;
    else {
      res.status(400).json({ error: 'BadRequest', message: 'Invalid bundle_id' });
      return;
    }

    const referenceId = `stripe_mock_${Date.now()}`;
    const user = await purchaseCoins(userId, coinsToAdd, referenceId);

    res.json({
      success: true,
      coinsAdded: coinsToAdd,
      balance: {
        earned: user.earned_coins,
        purchased: user.purchased_coins,
        locked: user.locked_coins,
        total: user.earned_coins + user.purchased_coins + user.locked_coins,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
