import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { cashManagementService } from './cash-management.service';

export const denominationSchema = z.object({
  notes5000: z.number().int().nonnegative().optional(),
  notes2000: z.number().int().nonnegative().optional(),
  notes1000: z.number().int().nonnegative().optional(),
  notes500: z.number().int().nonnegative().optional(),
  notes100: z.number().int().nonnegative().optional(),
  notes50: z.number().int().nonnegative().optional(),
  notes20: z.number().int().nonnegative().optional(),
  notes10: z.number().int().nonnegative().optional(),
  coinsTotal: z.number().nonnegative().optional(),
});

export const cashMovementSchema = z.object({
  branchId: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required'),
});

export const dispatchTransferSchema = z.object({
  requestId: z.string().uuid().optional(),
  sourceBranchId: z.string().min(1, 'Source branch is required'),
  destBranchId: z.string().min(1, 'Destination branch is required'),
  amount: z.number().positive('Amount must be positive'),
  transportPersonName: z.string().min(1, 'Transport person name is required'),
  transportPersonNic: z.string().optional(),
  securityBagSealNo: z.string().optional(),
  denominations: denominationSchema.optional(),
});

export const receiveTransferSchema = z.object({
  transferId: z.string().uuid('Invalid transfer ID'),
  denominations: denominationSchema,
  notes: z.string().optional(),
});

export class CashManagementController {
  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await cashManagementService.getDashboardSummary();
      return res.status(200).json({ success: true, ...data });
    } catch (err) {
      next(err);
    }
  }

  // --- Banks ---
  async getBanks(req: Request, res: Response, next: NextFunction) {
    try {
      const accounts = await cashManagementService.getBankAccounts();
      return res.status(200).json({ success: true, accounts });
    } catch (err) {
      next(err);
    }
  }

  async createBank(req: Request, res: Response, next: NextFunction) {
    try {
      const account = await cashManagementService.createBankAccount(req.body);
      return res.status(201).json({ success: true, account });
    } catch (err) {
      next(err);
    }
  }

  // --- Tills ---
  async getTills(req: Request, res: Response, next: NextFunction) {
    try {
      const branch = (req.user?.role === 'ADMIN' || req.user?.role === 'AUDITOR')
        ? (req.query.branchId as string || 'ALL')
        : (req.user?.trustedBranchId || 'HQ');
      const tills = await cashManagementService.getTills(branch);
      return res.status(200).json({ success: true, tills });
    } catch (err) {
      next(err);
    }
  }

  async openTill(req: Request, res: Response, next: NextFunction) {
    try {
      const { tillId, openingCash } = req.body;
      const session = await cashManagementService.openTillSession(
        tillId,
        req.user!.id,
        req.user!.trustedBranchId,
        Number(openingCash)
      );
      return res.status(201).json({ success: true, session });
    } catch (err) {
      next(err);
    }
  }

  async closeTill(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId, denominations, notes } = req.body;
      const validDenoms = denominationSchema.parse(denominations);
      const session = await cashManagementService.closeTillSession(
        sessionId,
        validDenoms,
        req.user!.email,
        notes
      );
      return res.status(200).json({ success: true, session });
    } catch (err) {
      next(err);
    }
  }

  // --- Cash-In & Cash-Out ---
  async cashIn(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = cashMovementSchema.parse(req.body);
      const branchId = validated.branchId || req.user!.trustedBranchId;
      const result = await cashManagementService.cashIn({
        ...validated,
        branchId,
        actor: {
          id: req.user!.id,
          email: req.user!.email,
          role: req.user!.role,
          branchId: req.user!.trustedBranchId,
        },
      });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async cashOut(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = cashMovementSchema.parse(req.body);
      const branchId = validated.branchId || req.user!.trustedBranchId;
      const result = await cashManagementService.cashOut({
        ...validated,
        branchId,
        actor: {
          id: req.user!.id,
          email: req.user!.email,
          role: req.user!.role,
          branchId: req.user!.trustedBranchId,
        },
      });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  // --- Requests ---
  async getRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const branch = (req.user?.role === 'ADMIN' || req.user?.role === 'AUDITOR')
        ? (req.query.branchId as string || 'ALL')
        : (req.user?.trustedBranchId || 'HQ');
      const requests = await cashManagementService.getCashRequests(branch);
      return res.status(200).json({ success: true, requests });
    } catch (err) {
      next(err);
    }
  }

  async createRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const { requestedAmount, requiredDate, purpose } = req.body;
      const request = await cashManagementService.createCashRequest({
        requestingBranchId: req.user!.trustedBranchId,
        requestedByUserId: req.user!.id,
        requestedAmount: Number(requestedAmount),
        requiredDate: new Date(requiredDate),
        purpose,
      });
      return res.status(201).json({ success: true, request });
    } catch (err) {
      next(err);
    }
  }

  // --- Transfers ---
  async getTransfers(req: Request, res: Response, next: NextFunction) {
    try {
      const branch = (req.user?.role === 'ADMIN' || req.user?.role === 'AUDITOR')
        ? (req.query.branchId as string || 'ALL')
        : (req.user?.trustedBranchId || 'HQ');
      const transfers = await cashManagementService.getTransfers(branch);
      return res.status(200).json({ success: true, transfers });
    } catch (err) {
      next(err);
    }
  }

  async dispatch(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = dispatchTransferSchema.parse(req.body);
      const transfer = await cashManagementService.dispatchCash({
        ...validated,
        dispatchedByUserId: req.user!.id,
        actorEmail: req.user!.email,
      });
      return res.status(201).json(transfer);
    } catch (err) {
      next(err);
    }
  }

  async receive(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = receiveTransferSchema.parse(req.body);
      const transfer = await cashManagementService.receiveCash({
        ...validated,
        receivedByUserId: req.user!.id,
        actorEmail: req.user!.email,
      });
      return res.status(200).json(transfer);
    } catch (err) {
      next(err);
    }
  }
}

export const cashManagementController = new CashManagementController();
