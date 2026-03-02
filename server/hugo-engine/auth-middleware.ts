/**
 * JWT Authentication Middleware for Express
 *
 * Verifies Supabase JWT tokens and extracts user identity.
 * Applied globally to /api/* routes (with exemptions for health/webhooks).
 */

import { type Request, type Response, type NextFunction } from 'express';
import { supabase } from './supabase-client';

// Extend Express Request with authenticated user info
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      isAdmin?: boolean;
    }
  }
}

/**
 * Verify Supabase JWT and attach user info to request.
 * Returns 401 if no valid token is provided.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.userId = user.id;
    req.userEmail = user.email || undefined;
    req.isAdmin = user.email?.endsWith('@hugoherbots.com') || false;
    next();
  } catch (err) {
    console.error('[Auth] Token verification failed:', err);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Require admin role (must be used after requireAuth).
 * Returns 403 if user is not an admin.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Optional auth — extracts user if token is present, but doesn't block.
 * Useful for endpoints that work for both authenticated and anonymous users.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) {
      req.userId = user.id;
      req.userEmail = user.email || undefined;
      req.isAdmin = user.email?.endsWith('@hugoherbots.com') || false;
    }
  } catch {
    // Token invalid, continue without auth
  }

  next();
}
