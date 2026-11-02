import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { accountingService } from './accounting.service';

const expenseSchema = z.object({
  branchId: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  amount: z.number().positive('Amount must be positive'),
});

const journalEntrySchema = z.object({
  date: z.string().transform((v) => new Date(v)),
  description: z.string().min(1, 'Description is required'),
  reference: z.string().optional(),
  lines: z.array(
    z.object({
      accountId: z.string().optional(),
      accountName: z.string().min(1, 'Account name is required'),
      debit: z.number().nonnegative(),
      credit: z.number().nonnegative(),
    })
  ).min(2, 'Journal entry requires at least 2 lines'),
});

export class AccountingController {
  async getDailyLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = (req.user?.role === 'ADMIN' || req.user?.role === 'AUDITOR')
        ? (req.query.branchId as string || 'HQ')
        : (req.user?.trustedBranchId || 'HQ');

      const dateStr = req.query.date as string;
      const ledger = await accountingService.getDailyLedger(branchId, dateStr);
      return res.status(200).json({ success: true, ledger });
    } catch (err) {
      next(err);
    }
  }

  async addExpense(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = expenseSchema.parse(req.body);
      const branchId = validated.branchId || req.user!.trustedBranchId;
      const result = await accountingService.addExpense({
        ...validated,
        branchId,
        actor: {
          id: req.user!.id,
          email: req.user!.email,
          role: req.user!.role,
          branchId: req.user!.trustedBranchId,
        },
      });
      return res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async postJournalEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = journalEntrySchema.parse(req.body);
      const result = await accountingService.postJournalEntry({
        ...validated,
        createdBy: req.user?.email || 'Accounting System',
      });
      return res.status(201).json({ success: true, journalEntry: result });
    } catch (err) {
      next(err);
    }
  }

  async getFinancialReports(req: Request, res: Response, next: NextFunction) {
    try {
      const branchId = req.query.branchId as string;
      const reports = await accountingService.getFinancialReports(branchId);
      return res.status(200).json({ success: true, reports });
    } catch (err) {
      next(err);
    }
  }
}

export const accountingController = new AccountingController();

