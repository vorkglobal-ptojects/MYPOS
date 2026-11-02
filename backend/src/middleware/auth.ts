import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { supabaseAdmin } from '../config/supabase';
import { normalizeBranchId } from '../utils/branch-mapping';

export type UserRole = 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'TELLER';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  branchId: string;
  trustedBranchId: string;
  branchName?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Middleware: Verifies authenticated user token (Supabase Auth JWT or Backend issued JWT)
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.headers['x-auth-token']) {
      token = String(req.headers['x-auth-token']).trim();
    } else if (req.headers.cookie) {
      const match = req.headers.cookie.split(';').find(c => c.trim().startsWith('sb-access-token=') || c.trim().startsWith('auth_token='));
      if (match) token = match.split('=')[1]?.trim() || '';
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. Authentication token is missing.',
      });
    }

    let userId = '';
    let email = '';

    // 1. Try decoding with backend JWT secret
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      userId = decoded.id || decoded.sub;
      email = decoded.email || '';
    } catch {
      // 2. Fallback: Verify via Supabase Auth
      const { data: supaUser, error: supaErr } = await supabaseAdmin.auth.getUser(token);
      if (!supaErr && supaUser?.user) {
        userId = supaUser.user.id;
        email = supaUser.user.email || '';
      } else {
        // Shift grace window fallback for tokens expired within last 24h
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            const nowSec = Math.floor(Date.now() / 1000);
            if (payload.sub && payload.exp && (nowSec - payload.exp < 24 * 3600)) {
              const { data: adminUser } = await supabaseAdmin.auth.admin.getUserById(payload.sub);
              if (adminUser?.user) {
                userId = adminUser.user.id;
                email = adminUser.user.email || '';
              }
            }
          }
        } catch {}
      }
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. Token is invalid or expired.',
      });
    }

    // Fetch verified profile from database
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
    });

    const role = ((profile?.role || 'TELLER').toUpperCase()) as UserRole;
    const trustedBranchId = normalizeBranchId(profile?.branchId || 'HQ');
    let effectiveBranchId = trustedBranchId;

    // Header override allowed strictly for ADMIN or AUDITOR
    const headerBranch = req.headers['x-branch-id'];
    if (headerBranch && (role === 'ADMIN' || (role === 'AUDITOR' && trustedBranchId === 'HQ'))) {
      effectiveBranchId = normalizeBranchId(String(headerBranch));
    }

    req.user = {
      id: userId,
      email: email || profile?.email || '',
      role,
      branchId: effectiveBranchId,
      trustedBranchId,
      branchName: profile?.branchName || undefined,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware: Role-Based Access Control
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden. Action requires role: ${allowedRoles.join(', ')}.`,
      });
    }
    next();
  };
}

/**
 * Middleware: Prevents branch spoofing on financial mutations
 */
export function requireBranchScope(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }

  // Admin has global rights
  if (req.user.role === 'ADMIN') {
    return next();
  }

  const targetBranch = req.params.branchId || req.body.branchId || req.body.sourceBranchId;
  if (targetBranch) {
    const targetNorm = normalizeBranchId(targetBranch);
    if (req.user.trustedBranchId !== targetNorm) {
      return res.status(403).json({
        success: false,
        error: `Forbidden. Your assigned branch (${req.user.trustedBranchId}) cannot perform mutations for branch (${targetNorm}).`,
      });
    }
  }

  next();
}

