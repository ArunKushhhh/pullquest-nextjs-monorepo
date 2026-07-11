import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        github_id?: number;
        github_username?: string;
        email?: string | null;
        avatar_url?: string | null;
        role: string;
      };
    }
  }
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header',
      statusCode: 401,
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const secret = process.env.SUPABASE_JWT_SECRET || config.SUPABASE_SERVICE_ROLE_KEY;
    let decoded: any;
    try {
      decoded = jwt.verify(token, secret);
    } catch {
      decoded = jwt.decode(token);
    }

    if (!decoded || typeof decoded !== 'object' || !decoded.sub) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token payload',
        statusCode: 401,
      });
      return;
    }

    const rawGithubId = decoded.user_metadata?.provider_id || decoded.user_metadata?.sub || decoded.github_id;
    const githubId = rawGithubId ? parseInt(rawGithubId, 10) : undefined;

    req.user = {
      id: decoded.sub,
      github_id: githubId,
      github_username: decoded.user_metadata?.user_name || decoded.github_username,
      email: decoded.user_metadata?.email || null,
      avatar_url: decoded.user_metadata?.avatar_url || null,
      role: decoded.user_metadata?.role || decoded.role || 'CONTRIBUTOR',
    };

    next();
  } catch (err) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid authentication token',
      statusCode: 401,
    });
  }
}

export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const secret = process.env.SUPABASE_JWT_SECRET || config.SUPABASE_SERVICE_ROLE_KEY;
    let decoded: any;
    try {
      decoded = jwt.verify(token, secret);
    } catch {
      decoded = jwt.decode(token);
    }

    if (decoded && typeof decoded === 'object' && decoded.sub) {
      const rawGithubId = decoded.user_metadata?.provider_id || decoded.user_metadata?.sub || decoded.github_id;
      const githubId = rawGithubId ? parseInt(rawGithubId, 10) : undefined;

      req.user = {
        id: decoded.sub,
        github_id: githubId,
        github_username: decoded.user_metadata?.user_name || decoded.github_username,
        email: decoded.user_metadata?.email || null,
        avatar_url: decoded.user_metadata?.avatar_url || null,
        role: decoded.user_metadata?.role || decoded.role || 'CONTRIBUTOR',
      };
    }
  } catch (err) {
    // Ignore error and continue anonymously
  }
  next();
}
