import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getOrgDashboard } from '../services/org.service.js';
import { getTreasuryBalance } from '../services/treasury.service.js';

const router = Router();

router.get('/:orgId/dashboard', async (req, res, next) => {
  try {
    const dashboard = await getOrgDashboard(req.params.orgId);
    res.json(dashboard);
  } catch (err) {
    next(err);
  }
});

router.get('/:orgId/treasury', authMiddleware, async (req, res, next) => {
  try {
    // Basic verification: user role must be ORG_ADMIN or PLATFORM_ADMIN to view treasury
    const role = req.user!.role;
    if (role !== 'ORG_ADMIN' && role !== 'PLATFORM_ADMIN') {
      res.status(403).json({ error: 'Forbidden', message: 'Insufficient access privileges' });
      return;
    }

    const balance = await getTreasuryBalance(req.params.orgId);
    res.json({ balance });
  } catch (err) {
    next(err);
  }
});

router.post('/:orgId/subscribe', authMiddleware, async (req, res, next) => {
  try {
    // Placeholder Stripe checkout redirect endpoint
    res.json({
      success: true,
      url: `https://checkout.stripe.com/pay/mock_session_${Date.now()}`,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
