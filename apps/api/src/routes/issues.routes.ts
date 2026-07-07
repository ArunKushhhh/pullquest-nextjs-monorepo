import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getStakableIssues, getIssueById } from '../services/issue.service.js';
import { stakeOnIssue } from '../services/stake.service.js';
import { Difficulty } from '@pullquest/shared';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;

    const filters = {
      org_id: req.query.org_id as string,
      difficulty: req.query.difficulty as Difficulty,
      is_open: req.query.is_open !== undefined ? req.query.is_open === 'true' : true,
    };

    const result = await getStakableIssues(filters, page, limit);

    res.json({
      data: result.data,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const issue = await getIssueById(req.params.id);
    if (!issue) {
      res.status(404).json({ error: 'NotFound', message: 'Issue not found' });
      return;
    }
    res.json(issue);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/stake', authMiddleware, async (req, res, next) => {
  try {
    const { amount } = req.body;
    const userId = req.user!.id;
    const issueId = req.params.id;

    if (!amount || typeof amount !== 'number') {
      res.status(400).json({ error: 'BadRequest', message: 'Missing or invalid stake amount' });
      return;
    }

    const stake = await stakeOnIssue(userId, issueId, amount);
    res.status(201).json(stake);
  } catch (err: any) {
    res.status(400).json({ error: 'BadRequest', message: err.message || 'Staking failed' });
  }
});

export default router;
