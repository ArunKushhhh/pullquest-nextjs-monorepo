import { Router } from 'express';
import { COIN_BUNDLES, isCoinBundleId } from '@pullquest/shared';
import { authMiddleware } from '../middleware/auth.js';
import { stripe } from '../config/stripe.js';
import {
  assertBundlePurchasableThisAct,
  CoinError,
  getUserBalance,
  listCoinBundlesForUser,
} from '../services/coin.service.js';
import { createSupabaseAdmin } from '@pullquest/database';

const router = Router();
const supabase = createSupabaseAdmin();

router.get('/balance', authMiddleware, async (req, res, next) => {
  try {
    const balance = await getUserBalance(req.user!.id);
    res.json(balance);
  } catch (err) {
    next(err);
  }
});

router.get('/bundles', authMiddleware, async (req, res, next) => {
  try {
    const bundles = await listCoinBundlesForUser(req.user!.id);
    res.json({ bundles });
  } catch (err) {
    next(err);
  }
});

router.post('/create-checkout-session', authMiddleware, async (req, res, next) => {
  try {
    const bundleId = req.body?.bundle_id;
    const userId = req.user!.id;

    if (!bundleId || !isCoinBundleId(bundleId)) {
      res.status(400).json({ error: 'BadRequest', message: 'Invalid or missing bundle_id' });
      return;
    }

    await assertBundlePurchasableThisAct(userId, bundleId);
    const bundle = COIN_BUNDLES[bundleId];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: bundle.name,
              description: `Credit ${bundle.amount} coins to your PullQuest account`,
            },
            unit_amount: bundle.priceCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?checkout=success&tab=purchases`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?checkout=cancel&tab=purchases`,
      metadata: {
        userId,
        bundleId,
        coinsToAdd: bundle.amount.toString(),
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    if (err instanceof CoinError) {
      res.status(err.statusCode).json({
        error: err.code,
        message: err.message,
        statusCode: err.statusCode,
      });
      return;
    }
    next(err);
  }
});

router.get('/purchase-history', authMiddleware, async (req, res, next) => {
  try {
    const { data: txs, error } = await supabase
      .from('coin_transactions')
      .select('*')
      .eq('user_id', req.user!.id)
      .eq('type', 'PURCHASE')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(txs);
  } catch (err) {
    next(err);
  }
});

export default router;
