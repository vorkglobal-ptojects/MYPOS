import { prisma } from '../../config/prisma';
import { normalizeBranchId } from '../../utils/branch-mapping';
import { toDecimal } from '../../utils/decimal';
import { getSriLankaDate } from '../../utils/date';
import Decimal from 'decimal.js';

export interface DenominationInput {
  notes5000?: number;
  notes2000?: number;
  notes1000?: number;
  notes500?: number;
  notes100?: number;
  notes50?: number;
  notes20?: number;
  notes10?: number;
  coinsTotal?: number;
}

export function sumDenominations(d: DenominationInput): Decimal {
  const sum = (
    (d.notes5000 || 0) * 5000 +
    (d.notes2000 || 0) * 2000 +
    (d.notes1000 || 0) * 1000 +
    (d.notes500 || 0) * 500 +
    (d.notes100 || 0) * 100 +
    (d.notes50 || 0) * 50 +
    (d.notes20 || 0) * 20 +
    (d.notes10 || 0) * 10 +
    (Number(d.coinsTotal) || 0)
  );
  return new Decimal(sum.toFixed(4));
}

export class CashManagementService {
  /**
   * Consolidated Cash Dashboard
   */
  async getDashboardSummary() {
    const [bankAccounts, activeTills, inTransitTransfers, pendingRequests, ledgers] = await Promise.all([
      prisma.bankAccount.findMany({ where: { isActive: true } }),
      prisma.tillSession.findMany({ where: { status: 'OPEN' } }),
      prisma.cashTransfer.findMany({ where: { status: 'DISPATCHED' } }),
      prisma.cashRequest.findMany({ where: { status: 'SUBMITTED' } }),
      prisma.dailyLedger.findMany({ orderBy: { ledgerDate: 'desc' }, take: 20 }),
    ]);

    const totalBankBalance = bankAccounts.reduce((sum, b) => sum + Number(b.currentBalance), 0);
    const totalTillCash = activeTills.reduce((sum, t) => sum + Number(t.openingCash), 0);
    const inTransitAmount = inTransitTransfers.reduce((sum, t) => sum + Number(t.dispatchedAmount), 0);
    const totalBranchCash = ledgers.reduce((sum, l) => sum + Number(l.closingBalance), 0);

    return {
      summary: {
        totalBankBalance,
        totalTillCash,
        inTransitAmount,
        inTransitCount: inTransitTransfers.length,
        pendingRequestsCount: pendingRequests.length,
        totalBranchCash,
        grandTotalLiquid: totalBankBalance + totalTillCash + totalBranchCash,
      },
      bankAccounts,
      activeTills,
      inTransitTransfers,
      pendingRequests,
    };
  }

  // --- Bank Accounts ---
  async getBankAccounts() {
    return prisma.bankAccount.findMany({
      orderBy: { bankName: 'asc' },
      include: { branch: true },
    });
  }

  async createBankAccount(data: { bankName: string; accountName: string; accountNumber: string; branchId?: string; currentBalance?: number }) {
    return prisma.bankAccount.create({
      data: {
        bankName: data.bankName,
        accountName: data.accountName,
        accountNumber: data.accountNumber,
        branchId: data.branchId ? normalizeBranchId(data.branchId) : null,
        currentBalance: toDecimal(data.currentBalance || 0),
      },
    });
  }

  // --- Cash Tills & Sessions ---
  async getTills(branchId?: string) {
    const where: any = { isActive: true };
    if (branchId && branchId !== 'ALL') where.branchId = normalizeBranchId(branchId);
    return prisma.cashTill.findMany({
      where,
      include: {
        branch: true,
        sessions: {
          where: { status: 'OPEN' },
          include: { user: true },
        },
      },
    });
  }

  /**
   * ACID Transaction: Open Cashier Till Session
   */
  async openTillSession(tillId: string, userId: string, branchId: string, openingCash: number) {
    return prisma.$transaction(async (tx) => {
      // Check if this till already has an OPEN session
      const active = await tx.tillSession.findFirst({
        where: { tillId, status: 'OPEN' },
      });

      if (active) {
        throw new Error('This cash till already has an active open session. Please close the active session first.');
      }

      const session = await tx.tillSession.create({
        data: {
          tillId,
          userId,
          branchId: normalizeBranchId(branchId),
          openingCash: toDecimal(openingCash),
          systemExpectedCash: toDecimal(openingCash),
          actualCountedCash: toDecimal(openingCash),
          status: 'OPEN',
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          branchId: normalizeBranchId(branchId),
          action: 'OPEN_TILL_SESSION',
          resource: 'CASH_TILLS',
          details: { tillId, sessionId: session.id, openingCash },
        },
      });

      return session;
    });
  }

  /**
   * ACID Transaction: Close Cashier Till Session with Denominations
   */
  async closeTillSession(sessionId: string, denoms: DenominationInput, actorEmail: string, notes?: string) {
    return prisma.$transaction(async (tx) => {
      const session = await tx.tillSession.findUnique({ where: { id: sessionId } });
      if (!session) throw new Error('Till session not found.');
      if (session.status !== 'OPEN') throw new Error(`Till session is already ${session.status}.`);

      const actualCash = sumDenominations(denoms);
      const expectedCash = new Decimal(session.systemExpectedCash.toString());
      const variance = actualCash.minus(expectedCash);

      // Record closing denominations
      await tx.tillDenomination.create({
        data: {
          sessionId,
          countType: 'CLOSING',
          notes5000: denoms.notes5000 || 0,
          notes2000: denoms.notes2000 || 0,
          notes1000: denoms.notes1000 || 0,
          notes500: denoms.notes500 || 0,
          notes100: denoms.notes100 || 0,
          notes50: denoms.notes50 || 0,
          notes20: denoms.notes20 || 0,
          notes10: denoms.notes10 || 0,
          coinsTotal: toDecimal(denoms.coinsTotal || 0),
          totalValue: actualCash,
        },
      });

      // Update session status
      const updated = await tx.tillSession.update({
        where: { id: sessionId },
        data: {
          closedAt: new Date(),
          actualCountedCash: actualCash,
          varianceAmount: variance,
          status: variance.isZero() ? 'CLOSED' : 'FLAGGED',
          notes,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userEmail: actorEmail,
          branchId: session.branchId,
          action: 'CLOSE_TILL_SESSION',
          resource: 'CASH_TILLS',
          details: {
            sessionId,
            expectedCash: expectedCash.toNumber(),
            actualCash: actualCash.toNumber(),
            variance: variance.toNumber(),
            status: updated.status,
          },
        },
      });

      return updated;
    });
  }

  /**
   * ACID Transaction: Cash-In Mutation
   */
  async cashIn(input: {
    branchId: string;
    amount: number;
    description: string;
    actor: { id: string; email: string; role: string; branchId: string };
  }) {
    return prisma.$transaction(async (tx) => {
      const branchId = normalizeBranchId(input.branchId);
      const today = new Date(getSriLankaDate());
      const amount = new Decimal(input.amount);

      let ledger = await tx.dailyLedger.findFirst({
        where: { branchId, ledgerDate: today },
      });

      if (!ledger) {
        ledger = await tx.dailyLedger.create({
          data: {
            branchId,
            ledgerDate: today,
            openingBalance: new Decimal(0),
            closingBalance: new Decimal(0),
            status: 'OPEN',
          },
        });
      }

      const previousBalance = new Decimal(ledger.closingBalance.toString());
      const newBalance = previousBalance.plus(amount);

      await tx.dailyLedger.update({
        where: { id: ledger.id },
        data: { closingBalance: newBalance },
      });

      // Immutable Transaction Trail
      await tx.transaction.create({
        data: {
          clientId: 'SYSTEM',
          type: 'CASH_IN',
          branchId,
          amount,
          description: `${input.description} | PrevBalance: Rs. ${previousBalance.toFixed(2)} | NewBalance: Rs. ${newBalance.toFixed(2)} | By: ${input.actor.email}`,
          timestamp: new Date(),
        },
      });

      // Balanced General Ledger
      const jeId = `JE-CASHIN-${Date.now()}`;
      await tx.journalEntry.create({
        data: {
          id: jeId,
          date: today,
          description: `Cash-In: ${input.description}`,
          reference: jeId,
          totalDebit: amount,
          totalCredit: amount,
          createdBy: input.actor.email,
          lines: {
            create: [
              {
                accountName: `Vault Cash (${branchId}) (Asset)`,
                debit: amount,
                credit: new Decimal(0),
              },
              {
                accountName: `Cash Receipts Clearing (${branchId})`,
                debit: new Decimal(0),
                credit: amount,
              },
            ],
          },
        },
      });

      return {
        success: true,
        amount: amount.toNumber(),
        previousBalance: previousBalance.toNumber(),
        newBalance: newBalance.toNumber(),
        journalEntryId: jeId,
      };
    });
  }

  /**
   * ACID Transaction: Cash-Out Mutation (Prevents Negative Cash Drawer Balances)
   */
  async cashOut(input: {
    branchId: string;
    amount: number;
    description: string;
    actor: { id: string; email: string; role: string; branchId: string };
  }) {
    return prisma.$transaction(async (tx) => {
      const branchId = normalizeBranchId(input.branchId);
      const today = new Date(getSriLankaDate());
      const amount = new Decimal(input.amount);

      let ledger = await tx.dailyLedger.findFirst({
        where: { branchId, ledgerDate: today },
      });

      if (!ledger) {
        ledger = await tx.dailyLedger.create({
          data: {
            branchId,
            ledgerDate: today,
            openingBalance: new Decimal(0),
            closingBalance: new Decimal(0),
            status: 'OPEN',
          },
        });
      }

      const previousBalance = new Decimal(ledger.closingBalance.toString());

      // Concurrency check: Reject if insufficient balance
      if (previousBalance.lessThan(amount)) {
        throw new Error(
          `Insufficient cash in branch drawer. Current balance: Rs. ${previousBalance.toFixed(2)}, Requested: Rs. ${amount.toFixed(2)}. Operation rejected to prevent negative cash drawer balance.`
        );
      }

      const newBalance = previousBalance.minus(amount);

      await tx.dailyLedger.update({
        where: { id: ledger.id },
        data: { closingBalance: newBalance },
      });

      // Immutable Transaction Record
      await tx.transaction.create({
        data: {
          clientId: 'SYSTEM',
          type: 'CASH_OUT',
          branchId,
          amount,
          description: `${input.description} | PrevBalance: Rs. ${previousBalance.toFixed(2)} | NewBalance: Rs. ${newBalance.toFixed(2)} | By: ${input.actor.email}`,
          timestamp: new Date(),
        },
      });

      // Balanced Double-Entry General Ledger
      const jeId = `JE-CASHOUT-${Date.now()}`;
      await tx.journalEntry.create({
        data: {
          id: jeId,
          date: today,
          description: `Cash-Out: ${input.description}`,
          reference: jeId,
          totalDebit: amount,
          totalCredit: amount,
          createdBy: input.actor.email,
          lines: {
            create: [
              {
                accountName: `Branch Expenses (${branchId})`,
                debit: amount,
                credit: new Decimal(0),
              },
              {
                accountName: `Vault Cash (${branchId}) (Asset)`,
                debit: new Decimal(0),
                credit: amount,
              },
            ],
          },
        },
      });

      return {
        success: true,
        amount: amount.toNumber(),
        previousBalance: previousBalance.toNumber(),
        newBalance: newBalance.toNumber(),
        journalEntryId: jeId,
      };
    });
  }

  // --- Cash Requests (Record 1) ---
  async getCashRequests(branchId?: string) {
    const where: any = {};
    if (branchId && branchId !== 'ALL') where.requestingBranchId = normalizeBranchId(branchId);
    return prisma.cashRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { transfers: true },
    });
  }

  async createCashRequest(data: {
    requestingBranchId: string;
    requestedByUserId: string;
    requestedAmount: number;
    requiredDate: Date;
    purpose?: string;
  }) {
    const ref = `REQ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    return prisma.cashRequest.create({
      data: {
        requestRef: ref,
        requestingBranchId: normalizeBranchId(data.requestingBranchId),
        requestedByUserId: data.requestedByUserId,
        requestedAmount: toDecimal(data.requestedAmount),
        requiredDate: data.requiredDate,
        purpose: data.purpose || 'PAWN_DISBURSEMENTS',
        status: 'SUBMITTED',
      },
    });
  }

  // --- Cash Transfers (Record 2 Dispatch & Record 3 Receipt) ---
  async getTransfers(branchId?: string) {
    const where: any = {};
    if (branchId && branchId !== 'ALL') {
      const norm = normalizeBranchId(branchId);
      where.OR = [{ sourceBranchId: norm }, { destBranchId: norm }];
    }
    return prisma.cashTransfer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { request: true, denominations: true },
    });
  }

  /**
   * ACID Transaction: Dispatch Cash Transfer (Record 2)
   * - Prevents negative vault balance at source
   */
  async dispatchCash(data: {
    requestId?: string;
    sourceBranchId: string;
    destBranchId: string;
    amount: number;
    dispatchedByUserId: string;
    transportPersonName: string;
    transportPersonNic?: string;
    securityBagSealNo?: string;
    actorEmail: string;
    denominations?: DenominationInput;
  }) {
    return prisma.$transaction(async (tx) => {
      const sourceBranch = normalizeBranchId(data.sourceBranchId);
      const destBranch = normalizeBranchId(data.destBranchId);
      const today = new Date(getSriLankaDate());
      const amount = new Decimal(data.amount);

      // Check source branch cash balance
      let srcLedger = await tx.dailyLedger.findFirst({
        where: { branchId: sourceBranch, ledgerDate: today },
      });

      if (!srcLedger) {
        srcLedger = await tx.dailyLedger.create({
          data: {
            branchId: sourceBranch,
            ledgerDate: today,
            openingBalance: new Decimal(0),
            closingBalance: new Decimal(0),
            status: 'OPEN',
          },
        });
      }

      const prevSourceBal = new Decimal(srcLedger.closingBalance.toString());
      if (prevSourceBal.lessThan(amount)) {
        throw new Error(
          `Insufficient cash in source branch vault (${sourceBranch}). Balance: Rs. ${prevSourceBal.toFixed(2)}, Dispatch amount: Rs. ${amount.toFixed(2)}. Transfer rejected to prevent negative cash balance.`
        );
      }

      // Deduct from source branch
      const newSourceBal = prevSourceBal.minus(amount);
      await tx.dailyLedger.update({
        where: { id: srcLedger.id },
        data: {
          closingBalance: newSourceBal,
          transferOut: new Decimal(srcLedger.transferOut.toString()).plus(amount),
        },
      });

      // Create transfer record
      const ref = `TRF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

      const transfer = await tx.cashTransfer.create({
        data: {
          transferRef: ref,
          requestId: data.requestId,
          sourceBranchId: sourceBranch,
          destBranchId: destBranch,
          dispatchedAmount: amount,
          dispatchedByUserId: data.dispatchedByUserId,
          dispatchTimestamp: new Date(),
          transportPersonName: data.transportPersonName,
          transportPersonNic: data.transportPersonNic,
          securityBagSealNo: data.securityBagSealNo,
          status: 'DISPATCHED',
        },
      });

      if (data.denominations) {
        await tx.cashTransferDenomination.create({
          data: {
            transferId: transfer.id,
            stage: 'DISPATCH',
            notes5000: data.denominations.notes5000 || 0,
            notes2000: data.denominations.notes2000 || 0,
            notes1000: data.denominations.notes1000 || 0,
            notes500: data.denominations.notes500 || 0,
            notes100: data.denominations.notes100 || 0,
            notes50: data.denominations.notes50 || 0,
            notes20: data.denominations.notes20 || 0,
            notes10: data.denominations.notes10 || 0,
            coinsTotal: toDecimal(data.denominations.coinsTotal || 0),
            totalAmount: amount,
          },
        });
      }

      if (data.requestId) {
        await tx.cashRequest.update({
          where: { id: data.requestId },
          data: { status: 'FULFILLED' },
        });
      }

      // Immutable Transaction Trail
      await tx.transaction.create({
        data: {
          clientId: 'SYSTEM',
          type: 'VAULT_TRANSFER_DISPATCH',
          branchId: sourceBranch,
          targetBranchId: destBranch,
          amount,
          description: `Dispatched cash transfer ${ref} to ${destBranch} | Prev: Rs. ${prevSourceBal.toFixed(2)} | New: Rs. ${newSourceBal.toFixed(2)} | By: ${data.actorEmail}`,
          timestamp: new Date(),
        },
      });

      return {
        success: true,
        transfer,
        sourcePreviousBalance: prevSourceBal.toNumber(),
        sourceNewBalance: newSourceBal.toNumber(),
      };
    });
  }

  /**
   * ACID Transaction: Receive Cash Transfer (Record 3)
   * - Prevents double acceptance
   * - Flags discrepancies
   * - Automatically posts balanced double-entry General Ledger entry
   */
  async receiveCash(data: {
    transferId: string;
    receivedByUserId: string;
    actorEmail: string;
    denominations: DenominationInput;
    notes?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const transfer = await tx.cashTransfer.findUnique({ where: { id: data.transferId } });
      if (!transfer) throw new Error('Transfer not found.');
      if (transfer.status === 'ACCEPTED') throw new Error('This transfer has already been accepted and posted.');

      const actualReceived = sumDenominations(data.denominations);
      const dispatched = new Decimal(transfer.dispatchedAmount.toString());
      const discrepancy = actualReceived.minus(dispatched);

      // Record receipt denominations
      await tx.cashTransferDenomination.create({
        data: {
          transferId: transfer.id,
          stage: 'RECEIPT',
          notes5000: data.denominations.notes5000 || 0,
          notes2000: data.denominations.notes2000 || 0,
          notes1000: data.denominations.notes1000 || 0,
          notes500: data.denominations.notes500 || 0,
          notes100: data.denominations.notes100 || 0,
          notes50: data.denominations.notes50 || 0,
          notes20: data.denominations.notes20 || 0,
          notes10: data.denominations.notes10 || 0,
          coinsTotal: toDecimal(data.denominations.coinsTotal || 0),
          totalAmount: actualReceived,
        },
      });

      // Add to destination branch cash ledger
      const destBranch = transfer.destBranchId;
      const today = new Date(getSriLankaDate());

      let dstLedger = await tx.dailyLedger.findFirst({
        where: { branchId: destBranch, ledgerDate: today },
      });

      if (!dstLedger) {
        dstLedger = await tx.dailyLedger.create({
          data: {
            branchId: destBranch,
            ledgerDate: today,
            openingBalance: new Decimal(0),
            closingBalance: new Decimal(0),
            status: 'OPEN',
          },
        });
      }

      const prevDestBal = new Decimal(dstLedger.closingBalance.toString());
      const newDestBal = prevDestBal.plus(actualReceived);

      await tx.dailyLedger.update({
        where: { id: dstLedger.id },
        data: {
          closingBalance: newDestBal,
          transferIn: new Decimal(dstLedger.transferIn.toString()).plus(actualReceived),
        },
      });

      // Balanced Double-Entry General Ledger Posting
      const jeId = `JE-TRF-${Date.now()}`;
      await tx.journalEntry.create({
        data: {
          id: jeId,
          date: today,
          description: `Cash Transfer Handover: ${transfer.sourceBranchId} to ${destBranch}`,
          reference: transfer.transferRef,
          totalDebit: actualReceived,
          totalCredit: actualReceived,
          createdBy: data.actorEmail,
          lines: {
            create: [
              {
                accountName: `Vault Cash (${destBranch}) (Asset)`,
                debit: actualReceived,
                credit: new Decimal(0),
              },
              {
                accountName: `Vault Cash (${transfer.sourceBranchId}) (Asset)`,
                debit: new Decimal(0),
                credit: actualReceived,
              },
            ],
          },
        },
      });

      // Update transfer status
      const updatedTransfer = await tx.cashTransfer.update({
        where: { id: data.transferId },
        data: {
          receivedAmount: actualReceived,
          discrepancyAmount: discrepancy,
          receivedByUserId: data.receivedByUserId,
          receiptTimestamp: new Date(),
          discrepancyNotes: data.notes,
          glJournalEntryId: jeId,
          status: discrepancy.isZero() ? 'ACCEPTED' : 'DISCREPANCY_FLAGGED',
        },
      });

      // Immutable Transaction Trail
      await tx.transaction.create({
        data: {
          clientId: 'SYSTEM',
          type: 'VAULT_TRANSFER_RECEIPT',
          branchId: destBranch,
          targetBranchId: transfer.sourceBranchId,
          amount: actualReceived,
          description: `Accepted cash transfer ${transfer.transferRef} from ${transfer.sourceBranchId} | Prev: Rs. ${prevDestBal.toFixed(2)} | New: Rs. ${newDestBal.toFixed(2)} | Discrepancy: Rs. ${discrepancy.toFixed(2)} | By: ${data.actorEmail}`,
          timestamp: new Date(),
        },
      });

      return {
        success: true,
        transfer: updatedTransfer,
        destPreviousBalance: prevDestBal.toNumber(),
        destNewBalance: newDestBal.toNumber(),
        discrepancyAmount: discrepancy.toNumber(),
        journalEntryId: jeId,
      };
    });
  }
}

export const cashManagementService = new CashManagementService();
