import { Router } from 'express';

const router = Router();

router.post('/', (req, res) => {
  console.log('[Stripe Webhook]: Received event', req.body);
  res.json({ received: true });
});

export default router;
