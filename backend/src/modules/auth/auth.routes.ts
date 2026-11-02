import { Router } from 'express';
import { authController } from './auth.controller';
import { requireAuth } from '../../middleware/auth';
import { authRateLimiter } from '../../middleware/rateLimiter';

const router = Router();

router.post('/login', authRateLimiter, (req, res, next) => authController.login(req, res, next));
router.post('/logout', (req, res) => authController.logout(req, res));
router.get('/me', requireAuth, (req, res, next) => authController.me(req, res, next));
router.post('/reset-request', authRateLimiter, (req, res, next) => authController.requestReset(req, res, next));

export default router;

