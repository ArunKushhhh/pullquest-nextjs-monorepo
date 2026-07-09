import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { stripe } from '../config/stripe.js';
import { getUserBalance } from '../services/coin.service.js';
import { createSupabaseAdmin } from '@pullquest/database';

const router = Router();
const supabase = createSupabaseAdmin();

// Coin bundle definitions
const COIN_BUNDLES: Record<string, { name: string; amount: number; priceCents: number }> = {
  coins_100: { name: '100 Coin Bundle', amount: 100, priceCents: 100 },      // $1.00
  coins_500: { name: '500 Coin Bundle', amount: 500, priceCents: 450 },      // $4.50 (10% discount)
  coins_1000: { name: '1000 Coin Bundle', amount: 1000, priceCents: 800 },   // $8.00 (20% discount)
};

// 1. Get user balance
router.get('/balance', authMiddleware, async (req, res, next) => {
  try {
    const balance = await getUserBalance(req.user!.id);
    res.json(balance);
  } catch (err) {
    next(err);
  }
});

// 2. Create Stripe checkout session for purchasing coins
router.post('/create-checkout-session', authMiddleware, async (req, res, next) => {
  try {
    const { bundle_id } = req.body;
    const userId = req.user!.id;

    if (!bundle_id || !COIN_BUNDLES[bundle_id]) {
      res.status(400).json({ error: 'BadRequest', message: 'Invalid or missing bundle_id' });
      return;
    }

    const bundle = COIN_BUNDLES[bundle_id];

    // Create Stripe Checkout Session
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
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?checkout=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?checkout=cancel`,
      metadata: {
        userId,
        bundleId: bundle_id,
        coinsToAdd: bundle.amount.toString(),
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

// 3. Get purchase transaction history
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
