import { Router } from 'express';
import { stripe } from '../config/stripe.js';
import { config } from '../config/env.js';
import { CoinError, purchaseCoins } from '../services/coin.service.js';
import Stripe from 'stripe';

const router = Router();

router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = config.STRIPE_WEBHOOK_SECRET;

  if (!sig) {
    console.error('[Stripe Webhook]: Missing stripe-signature header');
    res.status(400).send('Webhook Error: Missing signature');
    return;
  }

  let event: Stripe.Event;

  try {
    // req.body is a raw Buffer because of the express.raw middleware
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`[Stripe Webhook]: Signature verification failed: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  console.log(`[Stripe Webhook]: Processing verified event type: ${event.type}`);

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      const userId = session.metadata?.userId;
      const coinsToAddStr = session.metadata?.coinsToAdd;
      const bundleId = session.metadata?.bundleId;

      if (userId && coinsToAddStr) {
        const coinsToAdd = parseInt(coinsToAddStr, 10);
        try {
          await purchaseCoins(userId, coinsToAdd, session.id, bundleId);
          console.log(`[Stripe Webhook]: Successfully credited ${coinsToAdd} coins to user ${userId} for session ${session.id} (bundle: ${bundleId})`);
        } catch (err) {
          if (err instanceof CoinError && err.statusCode === 409) {
            console.log(`[Stripe Webhook]: Skipping duplicate bundle credit for user ${userId} session ${session.id}`);
          } else {
            throw err;
          }
        }
      } else {
        console.warn('[Stripe Webhook]: Checkout session completed but metadata values (userId/coinsToAdd) are missing:', session.metadata);
      }
    }
  } catch (err: any) {
    console.error('[Stripe Webhook]: Error executing business logic for event:', err);
    res.status(500).send('Internal Server Error');
    return;
  }

  res.json({ received: true });
});

export default router;
