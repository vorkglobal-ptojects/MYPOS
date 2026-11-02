import { Router } from 'express';
import { clientsController } from './clients.controller';
import { requireAuth, requireRole } from '../../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res, next) => clientsController.getClients(req, res, next));
router.get('/:id', (req, res, next) => clientsController.getClientById(req, res, next));
router.post('/', requireRole(['ADMIN', 'MANAGER', 'TELLER']), (req, res, next) => clientsController.createClient(req, res, next));
router.patch('/:id', requireRole(['ADMIN', 'MANAGER', 'TELLER']), (req, res, next) => clientsController.updateClient(req, res, next));

export default router;

