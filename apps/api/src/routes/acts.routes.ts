import { Router } from 'express';
import { getCurrentAct } from '../services/act.service.js';

const router = Router();

router.get('/current', async (req, res, next) => {
  try {
    const act = await getCurrentAct();
    if (!act) {
      res.status(404).json({ error: 'NotFound', message: 'No active seasonal Act found' });
      return;
    }
    res.json(act);
  } catch (err) {
    next(err);
  }
});

export default router;
