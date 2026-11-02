import jwt from 'jsonwebtoken';
import { prisma } from '../../config/prisma';
import { supabaseAdmin, supabasePublic } from '../../config/supabase';
import { env } from '../../config/env';
import { normalizeBranchId } from '../../utils/branch-mapping';

export class AuthService {
  /**
   * Authenticate user with Email/Username + Password + Branch
   */
  async login(input: { login: string; password: string; branchId?: string }) {
    let email = input.login.trim();
    if (!email.includes('@')) {
      email = email.toLowerCase() === 'admin' ? 'admin@gmail.com' : `${email.toLowerCase()}@gmail.com`;
    }

    // Sign in using Supabase Auth
    const { data: authData, error: authError } = await supabasePublic.auth.signInWithPassword({
      email,
      password: input.password,
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message || 'Invalid credentials');
    }

    const userId = authData.user.id;

    // Fetch user profile from database
    let profile = await prisma.profile.findUnique({
      where: { id: userId },
    });

    // If profile does not exist yet, initialize it
    if (!profile) {
      const metadata = authData.user.user_metadata || {};
      const branchId = normalizeBranchId(input.branchId || metadata.branch_id || 'HQ');
      profile = await prisma.profile.create({
        data: {
          id: userId,
          email,
          role: (metadata.role || 'TELLER').toUpperCase(),
          branchId,
          branchName: metadata.branch_name || 'Head Office',
        },
      });
    }

    // Issue JWT token with user context
    const token = jwt.sign(
      {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        branchId: profile.branchId,
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      token,
      refreshToken: authData.session?.refresh_token || '',
      user: {
        id: profile.id,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        role: profile.role,
        branchId: profile.branchId,
        branchName: profile.branchName,
      },
    };
  }

  /**
   * Get user profile by ID
   */
  async getProfile(userId: string) {
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      include: {
        branch: true,
      },
    });
    if (!profile) throw new Error('User profile not found');
    return profile;
  }

  /**
   * Create a password reset request
   */
  async requestPasswordReset(email: string, branchId?: string) {
    let cleanEmail = email.trim();
    if (!cleanEmail.includes('@')) {
      cleanEmail = cleanEmail.toLowerCase() === 'admin' ? 'admin@gmail.com' : `${cleanEmail.toLowerCase()}@gmail.com`;
    }

    await prisma.auditLog.create({
      data: {
        action: 'PASSWORD_RESET_REQUESTED',
        resource: 'USER_AUTH',
        userEmail: cleanEmail,
        branchId: normalizeBranchId(branchId),
        details: { requestedAt: new Date().toISOString() },
      },
    });

    return { success: true, message: 'Password reset request recorded for administrator review.' };
  }
}

export const authService = new AuthService();

