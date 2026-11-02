import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from './auth.service';

const loginSchema = z.object({
  email: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
  branch: z.string().optional(),
});

const resetSchema = z.object({
  email: z.string().min(1, 'Email is required'),
  branch: z.string().optional(),
});

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = loginSchema.parse(req.body);
      const result = await authService.login({
        login: validated.email,
        password: validated.password,
        branchId: validated.branch,
      });

      // Set cookie for session persistence
      res.cookie('auth_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      const profile = await authService.getProfile(req.user.id);
      return res.status(200).json({ success: true, user: profile });
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response) {
    res.clearCookie('auth_token');
    res.clearCookie('sb-access-token');
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  }

  async requestReset(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = resetSchema.parse(req.body);
      const result = await authService.requestPasswordReset(validated.email, validated.branch);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();

