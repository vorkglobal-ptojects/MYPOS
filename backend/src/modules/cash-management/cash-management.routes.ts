import { Router } from 'express';
import { cashManagementController } from './cash-management.controller';
import { requireAuth, requireRole } from '../../middleware/auth';

const router = Router();

router.use(requireAuth);

// Dashboard
router.get('/dashboard', (req, res, next) => cashManagementController.getDashboard(req, res, next));

// Cash-In & Cash-Out Mutations
router.post('/cash-in', requireRole(['ADMIN', 'MANAGER', 'TELLER']), (req, res, next) => cashManagementController.cashIn(req, res, next));
router.post('/cash-out', requireRole(['ADMIN', 'MANAGER', 'TELLER']), (req, res, next) => cashManagementController.cashOut(req, res, next));

// Bank Accounts
router.get('/banks', (req, res, next) => cashManagementController.getBanks(req, res, next));
router.post('/banks', requireRole(['ADMIN', 'MANAGER']), (req, res, next) => cashManagementController.createBank(req, res, next));

// Cash Tills & Sessions
router.get('/tills', (req, res, next) => cashManagementController.getTills(req, res, next));
router.post('/tills/open', requireRole(['ADMIN', 'MANAGER', 'TELLER']), (req, res, next) => cashManagementController.openTill(req, res, next));
router.post('/tills/close', requireRole(['ADMIN', 'MANAGER', 'TELLER']), (req, res, next) => cashManagementController.closeTill(req, res, next));

// Cash Requisitions (Record 1)
router.get('/requests', (req, res, next) => cashManagementController.getRequests(req, res, next));
router.post('/requests', requireRole(['ADMIN', 'MANAGER']), (req, res, next) => cashManagementController.createRequest(req, res, next));

// Cash Transfers (Record 2 Dispatch & Record 3 Receipt)
router.get('/transfers', (req, res, next) => cashManagementController.getTransfers(req, res, next));
router.post('/transfers/dispatch', requireRole(['ADMIN', 'MANAGER', 'TELLER']), (req, res, next) => cashManagementController.dispatch(req, res, next));
router.post('/transfers/receive', requireRole(['ADMIN', 'MANAGER', 'TELLER']), (req, res, next) => cashManagementController.receive(req, res, next));

export default router;
