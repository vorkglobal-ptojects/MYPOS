import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pawningService } from './pawning.service';

const evaluateSchema = z.object({
  airWeight: z.number().positive('Air weight must be positive'),
  waterWeight: z.number().positive('Water weight must be positive'),
  askingAmount: z.number().optional(),
  trueValue: z.number().optional(),
  airWeightPhotoUrl: z.string().optional(),
  waterWeightPhotoUrl: z.string().optional(),
  status: z.string().optional(),
});

export class PawningController {
  evaluatePurity(req: Request, res: Response, next: NextFunction) {
    try {
      const { airWeight, waterWeight } = req.body;
      if (!airWeight || !waterWeight) {
        return res.status(400).json({ success: false, error: 'airWeight and waterWeight are required' });
      }
      const result = pawningService.evaluateGoldPurity(Number(airWeight), Number(waterWeight));
      return res.status(200).json({ success: true, evaluation: result });
    } catch (err) {
      next(err);
    }
  }

  async recordEvaluation(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = evaluateSchema.parse(req.body);
      const record = await pawningService.recordEvaluation(validated);
      return res.status(201).json({ success: true, record });
    } catch (err) {
      next(err);
    }
  }

  async getEvaluations(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = parseInt(req.query.limit as string || '50', 10);
      const records = await pawningService.getEvaluations(limit);
      return res.status(200).json({ success: true, records });
    } catch (err) {
      next(err);
    }
  }
}

export const pawningController = new PawningController();

