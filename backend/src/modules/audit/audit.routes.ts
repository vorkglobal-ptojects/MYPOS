import { Router } from 'express';
import { auditController } from './audit.controller';
import { requireAuth, requireRole } from '../../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', requireRole(['ADMIN', 'AUDITOR']), (req, res, next) => auditController.getLogs(req, res, next));
router.post('/', (req, res, next) => auditController.recordLog(req, res, next));

export default router;

