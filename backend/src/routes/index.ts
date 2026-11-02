import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import clientsRoutes from '../modules/clients/clients.routes';
import loansRoutes from '../modules/loans/loans.routes';
import pawningRoutes from '../modules/pawning/pawning.routes';
import cashRoutes from '../modules/cash-management/cash-management.routes';
import accountingRoutes from '../modules/accounting/accounting.routes';
import auditRoutes from '../modules/audit/audit.routes';
import { auditController } from '../modules/audit/audit.controller';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../config/prisma';
import { CANONICAL_BRANCHES, normalizeBranchId } from '../utils/branch-mapping';

const apiV1Router = Router();

// Health Check
apiV1Router.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({
      status: 'UP',
      service: 'MIFOS Backend API Server',
      database: 'Connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'DEGRADED',
      database: 'Disconnected',
      error: err.message,
    });
  }
});

// Master Branches
apiV1Router.get('/branches', async (req, res) => {
  try {
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return res.status(200).json(branches.length > 0 ? branches : CANONICAL_BRANCHES);
  } catch {
    return res.status(200).json(CANONICAL_BRANCHES);
  }
});

// Dashboard Metrics (Real-Time Enterprise Aggregation)
apiV1Router.get('/dashboard/metrics', requireAuth, async (req, res, next) => {
  try {
    const userRole = req.user?.role || 'TELLER';
    const userBranch = req.user?.branchId || 'HQ';
    const isHead = !userBranch || normalizeBranchId(userBranch) === 'HQ' || userRole === 'ADMIN' || userRole === 'AUDITOR';

    const pawnWhere: any = {};
    if (!isHead) {
      pawnWhere.branchId = normalizeBranchId(userBranch);
    }

    const [clientCount, pawnsAgg, activePawnsCount, recentPawns] = await Promise.all([
      prisma.client.count(),
      prisma.pawn.aggregate({
        where: pawnWhere,
        _sum: { disbursedAmount: true },
        _count: true,
      }),
      prisma.pawn.count({
        where: { ...pawnWhere, status: 'ACTIVE' },
      }),
      prisma.pawn.findMany({
        where: pawnWhere,
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: {
          client: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
    ]);

    const totalPawnSum = pawnsAgg._sum.disbursedAmount ? Number(pawnsAgg._sum.disbursedAmount) : 0;
    const activePawns = activePawnsCount;

    const formattedTxs = recentPawns.map((p) => {
      const clientName = p.client
        ? `${p.client.firstName} ${p.client.lastName || ''}`.trim()
        : 'Customer';
      return {
        id: p.id,
        client_id: p.clientId,
        client_name: clientName,
        type: p.status || 'PAWN',
        amount: p.disbursedAmount ? Number(p.disbursedAmount) : 0,
        timestamp: p.createdAt.toISOString(),
      };
    });

    return res.status(200).json({
      success: true,
      clientCount,
      activePawns,
      totalPawnSum,
      recentTransactions: formattedTxs,
    });
  } catch (err) {
    next(err);
  }
});

// Reports Summary (Real-Time Portfolio & Ledger Breakdown)
apiV1Router.get('/reports/summary', requireAuth, async (req, res, next) => {
  try {
    const userRole = req.user?.role || 'TELLER';
    const userBranch = req.user?.branchId || 'HQ';
    const isHead = !userBranch || normalizeBranchId(userBranch) === 'HQ' || userRole === 'ADMIN' || userRole === 'AUDITOR';

    const pawnWhere: any = {};
    const txWhere: any = {};

    if (!isHead) {
      const canonical = normalizeBranchId(userBranch);
      pawnWhere.branchId = canonical;
      txWhere.OR = [{ branchId: canonical }, { targetBranchId: canonical }];
    }

    const [pawns, transactions] = await Promise.all([
      prisma.pawn.findMany({
        where: pawnWhere,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transaction.findMany({
        where: txWhere,
        take: 200,
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    const activePawns = pawns.filter((p) => p.status === 'ACTIVE');
    const redeemedPawns = pawns.filter((p) => p.status === 'REDEEMED');
    const totalActivePortfolio = activePawns.reduce((acc, p) => acc + (p.disbursedAmount ? Number(p.disbursedAmount) : 0), 0);
    const totalRedeemedSum = redeemedPawns.reduce((acc, p) => acc + (p.disbursedAmount ? Number(p.disbursedAmount) : 0), 0);

    return res.status(200).json({
      success: true,
      pawns,
      transactions: transactions.map((t) => ({
        id: t.id,
        client_id: t.clientId,
        type: t.type,
        branch_id: t.branchId || 'HQ',
        target_branch_id: t.targetBranchId || '',
        amount: t.amount ? Number(t.amount) : 0,
        description: t.description || '',
        timestamp: t.timestamp.toISOString(),
      })),
      metrics: {
        totalActivePortfolio,
        activeCount: activePawns.length,
        redeemedCount: redeemedPawns.length,
        totalRedeemedSum,
        totalPawnsCount: pawns.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Operational Transactions
apiV1Router.get('/transactions', requireAuth, (req, res, next) => auditController.getTransactions(req, res, next));
apiV1Router.post('/transactions', requireAuth, (req, res, next) => auditController.createTransaction(req, res, next));

// CCTV Agent Heartbeat
apiV1Router.post('/cctv/agent/heartbeat', async (req, res) => {
  try {
    const { agent_id, branch_id, camera_id, camera_status, timestamp } = req.body;
    await prisma.cctvAuditLog.create({
      data: {
        cameraId: camera_id,
        action: 'AGENT_HEARTBEAT',
        metadata: { agent_id, branch_id, camera_status, timestamp },
      },
    });
    return res.status(200).json({ success: true, acknowledged: true });
  } catch (err: any) {
    return res.status(200).json({ success: true, warning: err.message });
  }
});

// Mount Domain Modules
apiV1Router.use('/auth', authRoutes);
apiV1Router.use('/clients', clientsRoutes);
apiV1Router.use('/loans', loansRoutes);
apiV1Router.use('/pawning', pawningRoutes);
apiV1Router.use('/cash', cashRoutes);
apiV1Router.use('/accounting', accountingRoutes);
apiV1Router.use('/audit', auditRoutes);

export default apiV1Router;
