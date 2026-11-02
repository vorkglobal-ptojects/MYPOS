import { Router } from 'express';
import { accountingController } from './accounting.controller';
import { requireAuth, requireRole } from '../../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/ledger/daily', (req, res, next) => accountingController.getDailyLedger(req, res, next));
router.post('/ledger/expenses', requireRole(['ADMIN', 'MANAGER', 'TELLER']), (req, res, next) => accountingController.addExpense(req, res, next));
router.post('/journal', requireRole(['ADMIN', 'MANAGER', 'AUDITOR']), (req, res, next) => accountingController.postJournalEntry(req, res, next));
router.get('/reports', requireRole(['ADMIN', 'AUDITOR', 'MANAGER']), (req, res, next) => accountingController.getFinancialReports(req, res, next));

export default router;

