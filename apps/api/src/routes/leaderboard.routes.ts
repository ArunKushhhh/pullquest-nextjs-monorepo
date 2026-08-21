import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { getGlobalLeaderboard, getOrgLeaderboard } from '../services/leaderboard.service.js';
import { getCurrentAct } from '../services/act.service.js';

const router = Router();

router.get('/global', optionalAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;

    let actId = req.query.act_id as string;
    if (!actId) {
      const act = await getCurrentAct();
      if (!act) {
        res.json({ data: [], total: 0, page, limit, totalPages: 0 });
        return;
      }
      actId = act.id;
    }

    const result = await getGlobalLeaderboard(actId, page, limit, req.user?.id);

    res.json({
      data: result.data,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit) || 0,
      actId,
      me: result.me,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/org/:orgId', optionalAuth, async (req, res, next) => {
  try {
    const orgId = req.params.orgId;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;

    let actId = req.query.act_id as string;
    if (!actId) {
      const act = await getCurrentAct();
      if (!act) {
        res.json({ data: [], total: 0, page, limit, totalPages: 0 });
        return;
      }
      actId = act.id;
    }

    const result = await getOrgLeaderboard(orgId, actId, page, limit, req.user?.id);

    res.json({
      data: result.data,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit) || 0,
      actId,
      me: result.me,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
