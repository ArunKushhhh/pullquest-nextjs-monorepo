import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getOrgDashboard } from '../services/org.service.js';
import { canViewTreasury, getTreasuryView } from '../services/treasury.service.js';

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
    const orgId = req.params.orgId;
    const allowed = await canViewTreasury(req.user!.id, req.user!.role, orgId);
    if (!allowed) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Treasury balance is internal to organization admins',
      });
      return;
    }

    const view = await getTreasuryView(orgId);
    if (!view) {
      res.status(404).json({ error: 'NotFound', message: 'Organization not found' });
      return;
    }

    res.json(view);
  } catch (err) {
    next(err);
  }
});

router.post('/:orgId/subscribe', authMiddleware, async (req, res, next) => {
  try {
    res.json({
      success: true,
      url: `https://checkout.stripe.com/pay/mock_session_${Date.now()}`,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
