import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getPRById } from '../services/pr.service.js';
import { submitEvaluation, getEvaluationForPR } from '../services/evaluation.service.js';

const router = Router();

router.get('/:id', async (req, res, next) => {
  try {
    const pr = await getPRById(req.params.id);
    if (!pr) {
      res.status(404).json({ error: 'NotFound', message: 'Pull request not found' });
      return;
    }
    const evaluation = await getEvaluationForPR(pr.id);
    res.json({
      pr,
      evaluation,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/evaluate', authMiddleware, async (req, res, next) => {
  try {
    const prId = req.params.id;
    const maintainerId = req.user!.id;
    const scores = req.body; // EvaluationRequest structure

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
    res.status(201).json(evaluation);
  } catch (err: any) {
    res.status(400).json({ error: 'BadRequest', message: err.message || 'Evaluation failed' });
  }
});

export default router;
