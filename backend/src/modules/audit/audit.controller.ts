import { Request, Response, NextFunction } from 'express';
import { auditService } from './audit.service';

export class AuditController {
  async getLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const branchParam = req.query.branchId as string;
      const action = req.query.action as string;
      const limit = parseInt(req.query.limit as string || '100', 10);
      const offset = parseInt(req.query.offset as string || '0', 10);

      const effectiveBranch = (req.user?.role === 'ADMIN' || req.user?.role === 'AUDITOR')
        ? (branchParam || 'ALL')
        : (req.user?.trustedBranchId || 'HQ');

      const result = await auditService.getLogs({
        branchId: effectiveBranch,
        action,
        limit,
        offset,
      });

      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async recordLog(req: Request, res: Response, next: NextFunction) {
    try {
      const { action, resource, details } = req.body;
      const log = await auditService.recordLog({
        userId: req.user?.id,
        userEmail: req.user?.email,
        role: req.user?.role,
        branchId: req.user?.trustedBranchId,
        action,
        resource,
        details,
      });
      return res.status(201).json({ success: true, log });
    } catch (err) {
      next(err);
    }
  }

  async getTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const branchParam = req.query.branchId as string;
      const limit = parseInt(req.query.limit as string || '100', 10);
      const offset = parseInt(req.query.offset as string || '0', 10);

      const effectiveBranch = (req.user?.role === 'ADMIN' || req.user?.role === 'AUDITOR')
        ? (branchParam || 'ALL')
        : (req.user?.trustedBranchId || 'HQ');

      const transactions = await auditService.getTransactions({
        branchId: effectiveBranch,
        limit,
        offset,
      });

      return res.status(200).json(transactions);
    } catch (err) {
      next(err);
    }
  }

  async createTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const { client_id, clientId, type, branch_id, branchId, target_branch_id, targetBranchId, amount, description } = req.body;

      const tx = await auditService.recordTransaction({
        clientId: client_id || clientId || 'INTERNAL_TRANSFER',
        type: type || 'TRANSFER',
        branchId: branch_id || branchId || req.user?.branchId || 'HQ',
        targetBranchId: target_branch_id || targetBranchId,
        amount: parseFloat(amount) || 0,
        description: description || 'Branch Operation',
      });

      return res.status(201).json(tx);
    } catch (err) {
      next(err);
    }
  }
}

export const auditController = new AuditController();

