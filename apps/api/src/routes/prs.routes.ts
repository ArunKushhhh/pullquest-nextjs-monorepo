import { Router } from 'express';
import { calculateXP, getTrustMultiplier, XP_CAPS, type Difficulty } from '@pullquest/shared';
import { authMiddleware } from '../middleware/auth.js';
import { getPRById } from '../services/pr.service.js';
import {
  EvaluationError,
  getEvaluationForPR,
  listPendingEvaluations,
  submitEvaluation,
} from '../services/evaluation.service.js';
import { getXpLogForPR } from '../services/xp.service.js';

const router = Router();

function firstJoin<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

router.get('/pending-evaluation', authMiddleware, async (req, res, next) => {
  try {
    const pending = await listPendingEvaluations(req.user!.id);
    res.json(pending);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const pr = await getPRById(req.params.id);
    if (!pr) {
      res.status(404).json({ error: 'NotFound', message: 'Pull request not found' });
      return;
    }
    const [evaluation, xpLog] = await Promise.all([
      getEvaluationForPR(pr.id),
      getXpLogForPR(pr.id),
    ]);

    const issue = firstJoin(
      (pr as { issues?: { difficulty?: Difficulty } | Array<{ difficulty?: Difficulty }> }).issues
    );
    const repo = firstJoin(
      (
        pr as {
          repositories?: {
            full_name: string;
            star_count: number;
            member_count: number;
          } | Array<{ full_name: string; star_count: number; member_count: number }>;
        }
      ).repositories
    );

    const difficulty = (issue?.difficulty ?? 'HARD') as Difficulty;
    const trustMultiplier = getTrustMultiplier(repo?.member_count || 0, repo?.star_count || 0);
    const xpCap = XP_CAPS[difficulty];

    res.json({
      pr,
      evaluation,
      xpLog,
      repo: repo ?? null,
      xpPreview: {
        difficulty,
        xpCap,
        trustMultiplier,
        formula: 'Cap × (Evaluation / 5) × Trust Multiplier',
        maxXp: calculateXP(difficulty, 5, trustMultiplier),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/evaluate', authMiddleware, async (req, res, next) => {
  try {
    const prId = req.params.id;
    const maintainerId = req.user!.id;
    const scores = req.body;

    const requiredFields = [
      'code_quality_score',
      'complexity_score',
      'test_coverage_score',
      'documentation_score',
      'overall_score',
    ];

    for (const field of requiredFields) {
      if (scores[field] === undefined || typeof scores[field] !== 'number') {
        res.status(400).json({
          error: 'BadRequest',
          message: `Missing or invalid field: ${field}`,
        });
        return;
      }
    }

    const evaluation = await submitEvaluation(prId, maintainerId, scores);
    const xpLog = await getXpLogForPR(prId);
    res.status(201).json({ evaluation, xpLog });
  } catch (err: unknown) {
    if (err instanceof EvaluationError) {
      res.status(err.statusCode).json({ error: err.code, message: err.message });
      return;
    }
    next(err);
  }
});

export default router;
