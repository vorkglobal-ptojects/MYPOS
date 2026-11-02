import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { clientsService } from './clients.service';

const createClientSchema = z.object({
  nationalId: z.string().min(5, 'National ID is required'),
  firstName: z.string().min(1, 'First Name is required'),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  branchId: z.string().optional(),
  nicImage: z.string().optional(),
  signatureImage: z.string().optional(),
});

export class ClientsController {
  async getClients(req: Request, res: Response, next: NextFunction) {
    try {
      const branchParam = req.query.branchId as string;
      const search = req.query.search as string;
      const limit = parseInt(req.query.limit as string || '50', 10);
      const offset = parseInt(req.query.offset as string || '0', 10);

      // Enforce branch isolation for non-global roles
      const effectiveBranch = (req.user?.role === 'ADMIN' || req.user?.role === 'AUDITOR')
        ? (branchParam || 'ALL')
        : (req.user?.trustedBranchId || 'HQ');

      const result = await clientsService.getClients({
        branchId: effectiveBranch,
        search,
        userRole: req.user?.role,
        limit,
        offset,
      });

      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getClientById(req: Request, res: Response, next: NextFunction) {
    try {
      const client = await clientsService.getClientById(req.params.id);
      return res.status(200).json({ success: true, client });
    } catch (err) {
      next(err);
    }
  }

  async createClient(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createClientSchema.parse(req.body);
      const branchId = validated.branchId || req.user?.trustedBranchId || 'HQ';

      const client = await clientsService.createClient({
        ...validated,
        branchId,
        createdByUserId: req.user?.id,
      });

      return res.status(201).json({ success: true, client });
    } catch (err) {
      next(err);
    }
  }

  async updateClient(req: Request, res: Response, next: NextFunction) {
    try {
      const validated = createClientSchema.partial().parse(req.body);
      const client = await clientsService.updateClient(req.params.id, validated);
      return res.status(200).json({ success: true, client });
    } catch (err) {
      next(err);
    }
  }
}

export const clientsController = new ClientsController();

