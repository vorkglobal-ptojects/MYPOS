import { Router } from 'express';
import { pawningController } from './pawning.controller';
import { requireAuth } from '../../middleware/auth';

const router = Router();

router.use(requireAuth);

router.post('/evaluate', (req, res, next) => pawningController.evaluatePurity(req, res, next));
router.post('/records', (req, res, next) => pawningController.recordEvaluation(req, res, next));
router.get('/records', (req, res, next) => pawningController.getEvaluations(req, res, next));

export default router;

