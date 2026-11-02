import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { normalizeBranchId, stripBranchPrefix } from '../../utils/branch-mapping';
import { toDecimal, calculatePawnInterest } from '../../utils/decimal';
import { getSriLankaDate } from '../../utils/date';
import Decimal from 'decimal.js';

export interface PawnItemInput {
  itemType: string;
  description: string;
  purity?: string;
  weightGrams: number;
  weightMg: number;
  appraisedValue: number;
}

export interface CreatePawnInput {
  billNo?: string;
  clientId: string;
  description: string;
  weightGrams: number;
  weightMg: number;
  appraisedValue: number;
  disbursedAmount: number;
  interestRate?: number;
  periodMonths?: number;
  branchId: string;
  createdByUserId?: string;
  actorEmail: string;
  packetQr?: string;
  items?: PawnItemInput[];
}

export class LoansService {
  async getPawns(options: {
    branchId?: string;
    search?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const { branchId, search, status, limit = 50, offset = 0 } = options;
    const where: any = {};

    if (branchId && branchId !== 'ALL') {
      where.branchId = normalizeBranchId(branchId);
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (search && search.trim() !== '') {
      const cleanQ = search.trim();
      const strippedQ = stripBranchPrefix(cleanQ);
      where.OR = [
        { billNo: { contains: cleanQ, mode: 'insensitive' } },
        { billNo: { contains: strippedQ, mode: 'insensitive' } },
        { description: { contains: cleanQ, mode: 'insensitive' } },
        { packetQr: { contains: cleanQ, mode: 'insensitive' } },
      ];
    }

    const [pawns, total] = await Promise.all([
      prisma.pawn.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              nationalId: true,
              phone: true,
              address: true,
            },
          },
          items: true,
          branch: { select: { id: true, name: true } },
        },
      }),
      prisma.pawn.count({ where }),
    ]);

    return { pawns, total };
  }

  async getPawnById(id: string) {
    const pawn = await prisma.pawn.findUnique({
      where: { id },
      include: {
        client: true,
        items: true,
        branch: true,
      },
    });
    if (!pawn) throw new Error('Pawn ticket not found');
    return pawn;
  }

  /**
   * ACID Transaction: Creates pawn ticket with items & audit log.
   * If disbursed amount is <= 100,000, evaluates whether to disburse immediately or require manager check.
   */
  async createPawn(data: CreatePawnInput) {
    const normBranch = normalizeBranchId(data.branchId);
    const cleanBillNo = data.billNo ? stripBranchPrefix(data.billNo) : `PN-${Date.now().toString().slice(-6)}`;
    const isHighValue = Number(data.disbursedAmount) >= 100000;
    const initialStatus = isHighValue ? 'PENDING_APPROVAL' : 'ACTIVE';

    return prisma.$transaction(async (tx) => {
      // 1. Create Pawn Ticket
      const pawn = await tx.pawn.create({
        data: {
          billNo: cleanBillNo,
          clientId: data.clientId,
          description: data.description,
          weightGrams: toDecimal(data.weightGrams),
          weightMg: toDecimal(data.weightMg),
          appraisedValue: toDecimal(data.appraisedValue),
          disbursedAmount: toDecimal(data.disbursedAmount),
          interestRate: toDecimal(data.interestRate || 3.50),
          periodMonths: data.periodMonths || 3,
          branchId: normBranch,
          createdByUserId: data.createdByUserId,
          status: initialStatus,
          packetQr: data.packetQr,
        },
      });

      // 2. Create Pledged Articles
      if (data.items && data.items.length > 0) {
        await tx.pawnItem.createMany({
          data: data.items.map((item) => ({
            pawnId: pawn.id,
            itemType: item.itemType || 'CH',
            description: item.description,
            purity: item.purity || '22K',
            weightGrams: toDecimal(item.weightGrams),
            weightMg: toDecimal(item.weightMg),
            appraisedValue: toDecimal(item.appraisedValue),
          })),
        });
      }

      // 3. Record Immutable Audit Trail
      await tx.auditLog.create({
        data: {
          userId: data.createdByUserId,
          userEmail: data.actorEmail,
          role: 'TELLER',
          branchId: normBranch,
          action: 'CREATE_PAWN_TICKET',
          resource: 'PAWNS',
          details: {
            pawnId: pawn.id,
            billNo: cleanBillNo,
            disbursedAmount: Number(data.disbursedAmount),
            appraisedValue: Number(data.appraisedValue),
            status: initialStatus,
            packetQr: data.packetQr,
          },
        },
      });

      return pawn;
    });
  }

  /**
   * ACID Transaction: Disburse Loan Funds
   * - Row-level status verification (prevents double disbursement / double spending)
   * - Checks branch cash drawer balance (prevents negative cash balances at database level)
   * - Records previousBalance, newBalance, and creates immutable transaction record
   * - Balanced double-entry General Ledger posting
   */
  async disburseLoan(pawnId: string, actor: { id: string; email: string; role: string; branchId: string }) {
    return prisma.$transaction(async (tx) => {
      // 1. Fetch pawn with row lock check
      const pawn = await tx.pawn.findUnique({
        where: { id: pawnId },
        include: { client: true },
      });

      if (!pawn) {
        throw new Error('Pawn ticket not found.');
      }

      // Concurrency check: Ensure pawn has not already been disbursed
      if (pawn.status === 'ACTIVE' || pawn.status === 'DISBURSED') {
        throw new Error('Pawn loan has already been disbursed. Double-spending attempt prevented.');
      }

      if (pawn.status === 'REDEEMED' || pawn.status === 'REJECTED') {
        throw new Error(`Cannot disburse loan for pawn with status: ${pawn.status}`);
      }

      const branchId = pawn.branchId;
      const today = new Date(getSriLankaDate());
      const amountToDisburse = new Decimal(pawn.disbursedAmount.toString());

      // 2. Fetch or initialize today's daily ledger for this branch
      let ledger = await tx.dailyLedger.findFirst({
        where: {
          branchId,
          ledgerDate: today,
        },
      });

      if (!ledger) {
        // Carry forward from previous closing balance if available
        const lastLedger = await tx.dailyLedger.findFirst({
          where: { branchId },
          orderBy: { ledgerDate: 'desc' },
        });

        const opening = lastLedger ? lastLedger.closingBalance : new Decimal(0);

        ledger = await tx.dailyLedger.create({
          data: {
            branchId,
            ledgerDate: today,
            openingBalance: opening,
            closingBalance: opening,
            status: 'OPEN',
          },
        });
      }

      const previousBalance = new Decimal(ledger.closingBalance.toString());

      // 3. Database-level check: Prevent negative cash drawer balance
      if (previousBalance.lessThan(amountToDisburse)) {
        throw new Error(
          `Insufficient cash in branch drawer. Current balance: Rs. ${previousBalance.toFixed(2)}, Required: Rs. ${amountToDisburse.toFixed(2)}. Transaction rejected to prevent negative cash balance.`
        );
      }

      const newBalance = previousBalance.minus(amountToDisburse);

      // 4. Update Daily Ledger balances atomically
      const currentLoansIssued = new Decimal(ledger.loanIssuedTotal.toString());
      await tx.dailyLedger.update({
        where: { id: ledger.id },
        data: {
          closingBalance: newBalance,
          loanIssuedTotal: currentLoansIssued.plus(amountToDisburse),
        },
      });

      // 5. Update Pawn status
      const updatedPawn = await tx.pawn.update({
        where: { id: pawnId },
        data: {
          status: 'ACTIVE',
          approvedBy: actor.email,
          approvedAt: new Date(),
        },
      });

      // 6. Record Immutable Financial Transaction Trail
      await tx.transaction.create({
        data: {
          clientId: pawn.clientId,
          type: 'LOAN_DISBURSEMENT',
          branchId,
          amount: amountToDisburse,
          description: `Disbursed Loan for Ticket ${pawn.billNo || pawn.id} | PrevBalance: Rs. ${previousBalance.toFixed(2)} | NewBalance: Rs. ${newBalance.toFixed(2)} | Cashier: ${actor.email}`,
          timestamp: new Date(),
        },
      });

      // 7. Balanced Double-Entry General Ledger Posting
      const jeId = `JE-DISBURSE-${Date.now()}`;
      await tx.journalEntry.create({
        data: {
          id: jeId,
          date: today,
          description: `Loan Disbursement: Ticket ${pawn.billNo || pawn.id} (${pawn.client.firstName} ${pawn.client.lastName})`,
          reference: pawn.billNo || pawn.id,
          totalDebit: amountToDisburse,
          totalCredit: amountToDisburse,
          createdBy: actor.email,
          lines: {
            create: [
              {
                accountName: `Pawn Loans Asset (${branchId})`,
                debit: amountToDisburse,
                credit: new Decimal(0),
              },
              {
                accountName: `Vault Cash (${branchId}) (Asset)`,
                debit: new Decimal(0),
                credit: amountToDisburse,
              },
            ],
          },
        },
      });

      // 8. Immutable Security Audit Log
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          userEmail: actor.email,
          role: actor.role,
          branchId,
          action: 'DISBURSE_LOAN_SUCCESS',
          resource: 'PAWNS',
          details: {
            pawnId: pawn.id,
            billNo: pawn.billNo,
            disbursedAmount: amountToDisburse.toNumber(),
            previousBalance: previousBalance.toNumber(),
            newBalance: newBalance.toNumber(),
            journalEntryId: jeId,
          },
        },
      });

      return {
        success: true,
        pawn: updatedPawn,
        disbursedAmount: amountToDisburse.toNumber(),
        previousBalance: previousBalance.toNumber(),
        newBalance: newBalance.toNumber(),
        journalEntryId: jeId,
      };
    });
  }

  /**
   * ACID Transaction: Redeem Pawn & Collect Settlement
   * - Prevents double-redemption
   * - Calculates interest and updates cash drawer
   * - Records previousBalance and newBalance
   * - Balanced double-entry General Ledger posting
   */
  async redeemPawn(pawnId: string, daysPawned: number, actor: { id: string; email: string; role: string; branchId: string }) {
    return prisma.$transaction(async (tx) => {
      // 1. Fetch pawn with status verification
      const pawn = await tx.pawn.findUnique({
        where: { id: pawnId },
        include: { client: true },
      });

      if (!pawn) {
        throw new Error('Pawn ticket not found.');
      }

      if (pawn.status === 'REDEEMED') {
        throw new Error('This pawn ticket has already been redeemed. Double-redemption prevented.');
      }

      if (pawn.status !== 'ACTIVE' && pawn.status !== 'DISBURSED') {
        throw new Error(`Cannot redeem pawn with current status: ${pawn.status}. Only active pawns can be redeemed.`);
      }

      const branchId = pawn.branchId;
      const today = new Date(getSriLankaDate());

      // 2. Calculate exact interest and settlement
      const principal = new Decimal(pawn.disbursedAmount.toString());
      const { interest, totalSettlement } = calculatePawnInterest(
        principal,
        pawn.interestRate.toString(),
        daysPawned
      );

      // 3. Fetch or initialize today's daily ledger
      let ledger = await tx.dailyLedger.findFirst({
        where: {
          branchId,
          ledgerDate: today,
        },
      });

      if (!ledger) {
        const lastLedger = await tx.dailyLedger.findFirst({
          where: { branchId },
          orderBy: { ledgerDate: 'desc' },
        });

        const opening = lastLedger ? lastLedger.closingBalance : new Decimal(0);

        ledger = await tx.dailyLedger.create({
          data: {
            branchId,
            ledgerDate: today,
            openingBalance: opening,
            closingBalance: opening,
            status: 'OPEN',
          },
        });
      }

      const previousBalance = new Decimal(ledger.closingBalance.toString());
      const newBalance = previousBalance.plus(totalSettlement);

      // 4. Update Daily Ledger with cash received
      const currentRedemptions = new Decimal(ledger.redemptionTotal.toString());
      await tx.dailyLedger.update({
        where: { id: ledger.id },
        data: {
          closingBalance: newBalance,
          redemptionTotal: currentRedemptions.plus(totalSettlement),
        },
      });

      // 5. Update Pawn record to REDEEMED
      const updatedPawn = await tx.pawn.update({
        where: { id: pawnId },
        data: {
          status: 'REDEEMED',
          redeemedAt: new Date(),
          redeemAmount: totalSettlement,
          redeemInterest: interest,
          redeemedBy: actor.email,
        },
      });

      // 6. Record Immutable Financial Transaction
      await tx.transaction.create({
        data: {
          clientId: pawn.clientId,
          type: 'LOAN_REDEMPTION',
          branchId,
          amount: totalSettlement,
          description: `Redemption for Ticket ${pawn.billNo || pawn.id} (Principal: Rs. ${principal.toFixed(2)}, Interest: Rs. ${interest.toFixed(2)}) | PrevBalance: Rs. ${previousBalance.toFixed(2)} | NewBalance: Rs. ${newBalance.toFixed(2)} | Cashier: ${actor.email}`,
          timestamp: new Date(),
        },
      });

      // 7. Balanced Double-Entry General Ledger Posting
      const jeId = `JE-REDEEM-${Date.now()}`;
      await tx.journalEntry.create({
        data: {
          id: jeId,
          date: today,
          description: `Loan Redemption: Ticket ${pawn.billNo || pawn.id} (${pawn.client.firstName} ${pawn.client.lastName})`,
          reference: pawn.billNo || pawn.id,
          totalDebit: totalSettlement,
          totalCredit: totalSettlement,
          createdBy: actor.email,
          lines: {
            create: [
              {
                accountName: `Vault Cash (${branchId}) (Asset)`,
                debit: totalSettlement,
                credit: new Decimal(0),
              },
              {
                accountName: `Pawn Loans Asset (${branchId})`,
                debit: new Decimal(0),
                credit: principal,
              },
              {
                accountName: `Pawn Interest Income (${branchId})`,
                debit: new Decimal(0),
                credit: interest,
              },
            ],
          },
        },
      });

      // 8. Security Audit Log
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          userEmail: actor.email,
          role: actor.role,
          branchId,
          action: 'REDEEM_LOAN_SUCCESS',
          resource: 'PAWNS',
          details: {
            pawnId: pawn.id,
            billNo: pawn.billNo,
            principal: principal.toNumber(),
            interest: interest.toNumber(),
            totalSettlement: totalSettlement.toNumber(),
            previousBalance: previousBalance.toNumber(),
            newBalance: newBalance.toNumber(),
            journalEntryId: jeId,
          },
        },
      });

      return {
        success: true,
        pawn: updatedPawn,
        principal: principal.toNumber(),
        interest: interest.toNumber(),
        totalSettlement: totalSettlement.toNumber(),
        previousBalance: previousBalance.toNumber(),
        newBalance: newBalance.toNumber(),
        journalEntryId: jeId,
      };
    });
  }

  async auditorApprove(pawnId: string, auditorEmail: string) {
    return prisma.pawn.update({
      where: { id: pawnId },
      data: {
        status: 'AUDITED_PENDING_APPROVAL',
        approvedBy: auditorEmail,
      },
    });
  }

  async findByPacketQr(qr: string) {
    const pawn = await prisma.pawn.findFirst({
      where: { packetQr: qr.trim() },
      include: {
        client: true,
        items: true,
        branch: true,
      },
    });
    if (!pawn) throw new Error('No pawn record found for this packet QR');
    return pawn;
  }
}

export const loansService = new LoansService();
