import { prisma } from '../../config/prisma';
import { normalizeBranchId } from '../../utils/branch-mapping';

export class AuditService {
  async recordLog(data: {
    userId?: string;
    userEmail?: string;
    role?: string;
    branchId?: string;
    action: string;
    resource: string;
    details?: any;
  }) {
    return prisma.auditLog.create({
      data: {
        userId: data.userId,
        userEmail: data.userEmail,
        role: data.role,
        branchId: normalizeBranchId(data.branchId),
        action: data.action,
        resource: data.resource,
        details: data.details,
      },
    });
  }

  async getLogs(options: { branchId?: string; action?: string; limit?: number; offset?: number }) {
    const { branchId, action, limit = 100, offset = 0 } = options;
    const where: any = {};

    if (branchId && branchId !== 'ALL') {
      where.branchId = normalizeBranchId(branchId);
    }
    if (action) {
      where.action = action;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  async getTransactions(options: { branchId?: string; limit?: number; offset?: number }) {
    const { branchId, limit = 100, offset = 0 } = options;
    const where: any = {};

    if (branchId && branchId !== 'ALL' && branchId !== 'HQ') {
      const canonical = normalizeBranchId(branchId);
      where.OR = [
        { branchId: canonical },
        { targetBranchId: canonical },
      ];
    }

    const transactions = await prisma.transaction.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { timestamp: 'desc' },
    });

    return transactions.map((t) => ({
      id: t.id,
      client_id: t.clientId,
      type: t.type,
      branch_id: t.branchId || 'HQ',
      target_branch_id: t.targetBranchId || '',
      amount: t.amount ? Number(t.amount) : 0,
      description: t.description || '',
      timestamp: t.timestamp.toISOString(),
    }));
  }

  async recordTransaction(data: {
    clientId: string;
    type: string;
    branchId: string;
    targetBranchId?: string;
    amount: number;
    description?: string;
  }) {
    const t = await prisma.transaction.create({
      data: {
        clientId: data.clientId,
        type: data.type,
        branchId: normalizeBranchId(data.branchId),
        targetBranchId: data.targetBranchId ? normalizeBranchId(data.targetBranchId) : null,
        amount: data.amount,
        description: data.description,
        timestamp: new Date(),
      },
    });

    return {
      id: t.id,
      client_id: t.clientId,
      type: t.type,
      branch_id: t.branchId || 'HQ',
      target_branch_id: t.targetBranchId || '',
      amount: Number(t.amount),
      description: t.description || '',
      timestamp: t.timestamp.toISOString(),
    };
  }
}

export const auditService = new AuditService();

