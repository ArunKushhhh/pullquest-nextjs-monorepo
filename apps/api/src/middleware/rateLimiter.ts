import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis.js';

export async function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const key = `ratelimit:${ip}`;
  const limit = 100; // 100 requests
  const windowSecs = 60; // per 60 seconds

  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSecs);
    }

    if (current > limit) {
      const ttl = await redis.ttl(key);
      res.setHeader('Retry-After', ttl > 0 ? ttl : 1);
      res.status(429).json({
        error: 'TooManyRequests',
        message: 'Rate limit exceeded. Please try again later.',
        statusCode: 429,
      });
      return;
    }
    next();
  } catch (err) {
    console.error('[RateLimiter]: Redis error, bypassing rate limiting:', err);
    next();
  }
}
