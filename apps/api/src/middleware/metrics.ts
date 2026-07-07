import { Request, Response, NextFunction } from 'express';
import { apiRequestsTotal, apiRequestDuration } from '../metrics/definitions.js';

export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationSecs = diff[0] + diff[1] / 1e9;

    // Use router path format if matched (e.g. /api/issues/:id) or fall back to URL path
    const route = req.route ? req.route.path : req.path;
    const method = req.method;
    const statusCode = res.statusCode.toString();

    apiRequestsTotal.inc({ method, route, status_code: statusCode });
    apiRequestDuration.observe({ method, route }, durationSecs);
  });

  next();
}
