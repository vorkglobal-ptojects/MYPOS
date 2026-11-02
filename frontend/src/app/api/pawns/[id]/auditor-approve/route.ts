import { NextResponse } from 'next/server';
import { getAuthenticatedUser, adminSupabase } from '@/lib/auth-server';
import { normalizeBranchId } from '@/lib/branch-mapping';

export const dynamic = 'force-dynamic';

const isUUID = (str: string) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthenticatedUser(request);
    const { id } = await params;

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Authentication required.' }, { status: 401 });
    }

    // Role check: Only AUDITOR and ADMIN can submit Auditor Approval
    if (session.role !== 'AUDITOR' && session.role !== 'ADMIN') {
      return NextResponse.json({ 
        error: `Forbidden. Role '${session.role}' is not authorized to perform auditor approval.` 
      }, { status: 403 });
    }

    const body = await request.json();
    const { checklist, notes, confirmed } = body;

    if (!confirmed) {
      return NextResponse.json({ 
        error: 'The Auditor must explicitly confirm that all required verification checks have been completed and passed.' 
      }, { status: 400 });
    }

    // 1. Fetch Pawn Details by UUID or bill_no
    let query = adminSupabase.from('pawns').select('*');
    if (isUUID(id)) {
      query = query.eq('id', id);
    } else {
      query = query.eq('bill_no', id);
    }
    const { data: pawn, error: fetchErr } = await query.maybeSingle();

    if (fetchErr || !pawn) {
      return NextResponse.json({ error: 'Pawn transaction not found.' }, { status: 404 });
    }

    // 2. Auditors and Admins can audit transactions across all branches including Head Office

    // 3. Safety Check: Disallow auditor approval if an unresolved issue is active or status is REQUIRES_RECHECK
    if (pawn.status === 'REQUIRES_RECHECK') {
      return NextResponse.json({ 
        error: 'Cannot approve transaction. An unresolved auditor issue/discrepancy is active on this ticket. The issue must be rectified before approval.' 
      }, { status: 409 });
    }

    const cleanBill = pawn.bill_no || pawn.id.substring(0, 8).toUpperCase();
    let issueQuery = adminSupabase.from('audit_logs').select('*').eq('action', 'AUDIT_ISSUE_RAISED');
    if (cleanBill) {
      issueQuery = issueQuery.or(`resource.eq.${cleanBill},resource.eq.${pawn.id}`);
    } else {
      issueQuery = issueQuery.eq('resource', pawn.id);
    }
    const { data: issues } = await issueQuery;
    const hasUnresolvedIssue = (issues || []).some((l: any) => l.details?.status === 'REQUIRES_RECHECK' || l.details?.resolved === false);

    if (hasUnresolvedIssue) {
      return NextResponse.json({ 
        error: 'Cannot approve transaction. There is an active, unresolved Auditor issue note on this transaction.' 
      }, { status: 409 });
    }

    const auditorId = session.user?.id || (session as any).id || 'AUDITOR';
    const auditorEmail = session.user?.email || (session as any).email || 'auditor@mifos.lk';
    const branchId = pawn.branch_id || session.branchId || 'HQ';
    const timestamp = new Date().toISOString();

    const verificationPayload = {
      pawn_id: pawn.id,
      bill_no: cleanBill,
      branch_id: branchId,
      auditor_id: auditorId,
      auditor_email: auditorEmail,
      verification_result: 'PASSED',
      status: 'AUDITED_PENDING_APPROVAL',
      checklist: checklist || null,
      notes: notes || '',
      confirmed_at: timestamp
    };

    // 4. Save Record in audit_logs (maintains complete immutable audit trail)
    const { error: logErr } = await adminSupabase
      .from('audit_logs')
      .insert([{
        user_id: auditorId,
        user_email: auditorEmail,
        role: 'AUDITOR',
        branch_id: branchId,
        action: 'AUDITOR_APPROVED',
        resource: cleanBill,
        details: verificationPayload,
        created_at: timestamp
      }]);

    if (logErr) {
      console.error('Error recording auditor approval log:', logErr);
      throw logErr;
    }

    // 5. Change Transaction to Auditor-approved / Manager-pending State
    // (Notice: The Auditor does NOT update stock or release funds)
    const { error: updateErr } = await adminSupabase
      .from('pawns')
      .update({
        status: 'AUDITED_PENDING_APPROVAL'
      })
      .eq('id', pawn.id);

    if (updateErr) {
      console.error('Error updating pawn status to AUDITED_PENDING_APPROVAL:', updateErr);
      throw updateErr;
    }

    return NextResponse.json({
      success: true,
      message: `Auditor verification completed and confirmed for Bill #${cleanBill}. Ticket is now in 'AUDITED_PENDING_APPROVAL' awaiting Manager review.`,
      status: 'AUDITED_PENDING_APPROVAL',
      record: verificationPayload
    });
  } catch (error: any) {
    console.error('Auditor Approve POST Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to submit auditor approval' }, { status: 500 });
  }
}
