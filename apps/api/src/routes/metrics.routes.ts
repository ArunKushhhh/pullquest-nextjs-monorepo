import { Router } from 'express';
import { metricsRegistry } from '../metrics/definitions.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    res.set('Content-Type', metricsRegistry.contentType);
    res.end(await metricsRegistry.metrics());
  } catch (err) {
    next(err);
  }
});

export default router;
