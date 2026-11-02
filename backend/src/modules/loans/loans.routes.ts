import { Router } from 'express';
import { loansController } from './loans.controller';
import { requireAuth, requireRole } from '../../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res, next) => loansController.getPawns(req, res, next));
router.post('/calculate-interest', (req, res, next) => loansController.calculateInterest(req, res, next));
router.get('/packet-lookup', (req, res, next) => loansController.lookupPacket(req, res, next));
router.get('/:id', (req, res, next) => loansController.getPawnById(req, res, next));
router.post('/', requireRole(['ADMIN', 'MANAGER', 'TELLER']), (req, res, next) => loansController.createPawn(req, res, next));
router.post('/:id/auditor-approve', requireRole(['ADMIN', 'AUDITOR']), (req, res, next) => loansController.auditorApprove(req, res, next));
router.post('/:id/disburse', requireRole(['ADMIN', 'MANAGER', 'TELLER']), (req, res, next) => loansController.disburseLoan(req, res, next));
router.post('/:id/redeem', requireRole(['ADMIN', 'MANAGER', 'TELLER']), (req, res, next) => loansController.redeem(req, res, next));

export default router;
