import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { loansService } from './loans.service';
import { calculateRupasingheInterest } from '../../utils/decimal';

export const createPawnSchema = z.object({
  billNo: z.string().optional(),
  clientId: z.string().uuid('Invalid Client UUID format'),
  description: z.string().min(1, 'Description is required'),
  weightGrams: z.number().nonnegative('Weight in grams cannot be negative'),
  weightMg: z.number().nonnegative('Weight in milligrams cannot be negative'),
  appraisedValue: z.number().positive('Appraised value must be positive'),
  disbursedAmount: z.number().positive('Disbursed amount must be positive'),
  interestRate: z.number().positive().optional(),
  periodMonths: z.number().int().positive().optional(),
  branchId: z.string().optional(),
  packetQr: z.string().optional(),
  items: z.array(z.object({
    itemType: z.string(),
    description: z.string(),
    purity: z.string().optional(),
    weightGrams: z.number().nonnegative(),
    weightMg: z.number().nonnegative(),
    appraisedValue: z.number().nonnegative(),
  })).optional(),
});

export const redeemPawnSchema = z.object({
  days: z.number().int().min(1, 'Days must be at least 1'),
});

export const getPawnsQuerySchema = z.object({
  branchId: z.string().optional(),
  search: z.string().optional(),
  status: z.string().optional(),
  limit: z.string().optional().transform(v => (v ? parseInt(v, 10) : 50)),
  offset: z.string().optional().transform(v => (v ? parseInt(v, 10) : 0)),
});

export class LoansController {
  async getPawns(req: Request, res: Response, next: NextFunction) {
    try {
      const query = getPawnsQuerySchema.parse(req.query);

      const effectiveBranch = (req.user?.role === 'ADMIN' || req.user?.role === 'AUDITOR')
        ? (query.branchId || 'ALL')
        : (req.user?.trustedBranchId || 'HQ');

      const result = await loansService.getPawns({
        branchId: effectiveBranch,
        search: query.search,
        status: query.status,
        limit: query.limit,
        offset: query.offset,
      });

      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getPawnById(req: Request, res: Response, next: NextFunction) {
    try {
      const pawn = await loansService.getPawnById(req.params.id);
      return res.status(200).json({ success: true, pawn });
    } catch (err) {
      next(err);
    }
  }

  async createPawn(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createPawnSchema.parse(req.body);
      const branchId = validated.branchId || req.user?.trustedBranchId || 'HQ';

      const pawn = await loansService.createPawn({
        ...validated,
        branchId,
        createdByUserId: req.user?.id,
        actorEmail: req.user?.email || 'Teller',
      });

      return res.status(201).json({ success: true, pawn });
    } catch (err) {
      next(err);
    }
  }

  async disburseLoan(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await loansService.disburseLoan(req.params.id, {
        id: req.user!.id,
        email: req.user!.email,
        role: req.user!.role,
        branchId: req.user!.trustedBranchId,
      });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async auditorApprove(req: Request, res: Response, next: NextFunction) {
    try {
      const pawn = await loansService.auditorApprove(req.params.id, req.user?.email || 'Auditor');
      return res.status(200).json({ success: true, pawn });
    } catch (err) {
      next(err);
    }
  }

  async redeem(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = redeemPawnSchema.parse(req.body);
      const result = await loansService.redeemPawn(req.params.id, validated.days, {
        id: req.user!.id,
        email: req.user!.email,
        role: req.user!.role,
        branchId: req.user!.trustedBranchId,
      });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async lookupPacket(req: Request, res: Response, next: NextFunction) {
    try {
      const qr = req.query.qr as string;
      if (!qr) return res.status(400).json({ success: false, error: 'qr query parameter is required' });
      const pawn = await loansService.findByPacketQr(qr);
      return res.status(200).json({ success: true, pawn });
    } catch (err) {
      next(err);
    }
  }

  async calculateInterest(req: Request, res: Response, next: NextFunction) {
    try {
      const principal = parseFloat(req.body.principal || '0');
      const days = parseInt(req.body.days || '0', 10);
      const insurance = parseFloat(req.body.insurance || '50');

      if (!principal || principal <= 0) {
        return res.status(400).json({ success: false, error: 'Valid principal amount is required' });
      }

      const calculation = calculateRupasingheInterest(principal, days, insurance);
      return res.status(200).json({ success: true, ...calculation });
    } catch (err) {
      next(err);
    }
  }
}

export const loansController = new LoansController();
