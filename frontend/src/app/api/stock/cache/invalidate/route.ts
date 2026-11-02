import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { normalizeBranchId } from '@/lib/branch-mapping';
import { recordAuditLog } from '@/lib/audit-logger';
import { buildInventoryCacheKey, invalidateBranchInventoryCache } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await getAuthenticatedUser(req);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Authentication token is missing or invalid.' },
        { status: 401 }
      );
    }

    // Role check: Only AUDITOR and ADMIN can manually invalidate/force refresh inventory cache
    if (session.role !== 'AUDITOR' && session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: `Forbidden. Role '${session.role}' is not authorized to invalidate inventory cache. Auditor or Admin permissions required.` },
        { status: 403 }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    const requestedBranch = body?.branch;
    const requestedDate = body?.date;

    const isHead =
      !session.branchId ||
      normalizeBranchId(session.branchId) === 'HQ' ||
      session.branchId.toUpperCase() === 'HEAD OFFICE';

    let targetBranch = normalizeBranchId(session.branchId);

    if (session.role === 'ADMIN' || isHead) {
      // Admin or Head Office Auditor has cross-branch authority
      if (requestedBranch && requestedBranch.trim().toUpperCase() === 'ALL') {
        targetBranch = 'ALL';
      } else if (requestedBranch && requestedBranch.trim() !== '') {
        targetBranch = normalizeBranchId(requestedBranch);
      } else {
        targetBranch = 'ALL';
      }
    } else {
      // Branch-assigned Auditor is strictly bound to their assigned branch
      if (requestedBranch && normalizeBranchId(requestedBranch) !== normalizeBranchId(session.branchId)) {
        return NextResponse.json(
          {
            error: `Forbidden. Branch Auditor at branch (${session.branchId}) is not authorized to invalidate cache for branch (${requestedBranch}).`
          },
          { status: 403 }
        );
      }
      targetBranch = normalizeBranchId(session.branchId);
    }

    // Invalidate Redis cache for the authorized branch
    const result = await invalidateBranchInventoryCache(targetBranch, requestedDate);
    const primaryKey = buildInventoryCacheKey(targetBranch, requestedDate);

    // Record in immutable audit log
    await recordAuditLog(session, {
      action: 'INVENTORY_CACHE_INVALIDATED',
      resource: 'INVENTORY_CACHE',
      branchId: targetBranch,
      details: {
        cache_key: primaryKey,
        branch: targetBranch,
        date: requestedDate || 'ALL_DATES',
        reason: 'Manual inventory cache refresh',
        keys_invalidated: result.keys,
        total_keys: result.count
      },
      request: req
    });

    return NextResponse.json({
      success: true,
      message: `Inventory cache invalidated successfully for branch: ${targetBranch}`,
      branch: targetBranch,
      invalidated_keys: result.keys
    });
  } catch (err: any) {
    console.error('[Inventory Cache Invalidate Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
