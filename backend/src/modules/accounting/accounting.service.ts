import { prisma } from '../../config/prisma';
import { normalizeBranchId } from '../../utils/branch-mapping';
import { toDecimal } from '../../utils/decimal';
import { getSriLankaDate } from '../../utils/date';
import Decimal from 'decimal.js';

export interface JournalLineInput {
  accountId?: string;
  accountName: string;
  debit: number;
  credit: number;
}

export class AccountingService {
  /**
   * Get or initialize daily ledger for a branch
   */
  async getDailyLedger(branchId: string, dateStr?: string) {
    const normBranch = normalizeBranchId(branchId);
    const targetDate = dateStr ? new Date(dateStr) : new Date(getSriLankaDate());

    let ledger = await prisma.dailyLedger.findFirst({
      where: {
        branchId: normBranch,
        ledgerDate: targetDate,
      },
      include: {
        transactions: { orderBy: { createdAt: 'desc' } },
        expenses: { orderBy: { createdAt: 'desc' } },
        branch: true,
      },
    });

    if (!ledger) {
      // Find latest previous closing balance to carry forward
      const prev = await prisma.dailyLedger.findFirst({
        where: { branchId: normBranch },
        orderBy: { ledgerDate: 'desc' },
      });

      const opening = prev ? prev.closingBalance : new Decimal(0);

      ledger = await prisma.dailyLedger.create({
        data: {
          branchId: normBranch,
          ledgerDate: targetDate,
          openingBalance: opening,
          closingBalance: opening,
          status: 'OPEN',
        },
        include: {
          transactions: true,
          expenses: true,
          branch: true,
        },
      });
    }

    return ledger;
  }

  /**
   * ACID Transaction: Add Daily Ledger Expense
   * - Validates cash drawer balance (prevents negative cash balances)
   * - Deducts amount atomically from closing balance
   * - Creates immutable transaction record
   */
  async addExpense(input: {
    branchId: string;
    description: string;
    amount: number;
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

      const prevBal = new Decimal(ledger.closingBalance.toString());

      // Database check: Prevent negative cash drawer
      if (prevBal.lessThan(amount)) {
        throw new Error(
          `Cannot record expense: Insufficient cash drawer balance (Rs. ${prevBal.toFixed(2)}). Expense amount: Rs. ${amount.toFixed(2)}.`
        );
      }

      const newBal = prevBal.minus(amount);

      // 1. Record Expense Item
      const expense = await tx.dailyLedgerExpense.create({
        data: {
          dailyLedgerId: ledger.id,
          description: input.description,
          amount,
        },
      });

      // 2. Update Daily Ledger
      await tx.dailyLedger.update({
        where: { id: ledger.id },
        data: { closingBalance: newBal },
      });

      // 3. Record Immutable Financial Transaction
      await tx.transaction.create({
        data: {
          clientId: 'EXPENSE',
          type: 'BRANCH_EXPENSE',
          branchId,
          amount,
          description: `Expense: ${input.description} | Prev: Rs. ${prevBal.toFixed(2)} | New: Rs. ${newBal.toFixed(2)} | Cashier: ${input.actor.email}`,
          timestamp: new Date(),
        },
      });

      return {
        success: true,
        expense,
        previousBalance: prevBal.toNumber(),
        newBalance: newBal.toNumber(),
      };
    });
  }

  /**
   * ACID Transaction: Post Balanced Double-Entry General Ledger Journal Entry
   * - Validates sum(Debit) === sum(Credit)
   */
  async postJournalEntry(data: {
    date: Date;
    description: string;
    reference?: string;
    createdBy: string;
    lines: JournalLineInput[];
  }) {
    if (!data.lines || data.lines.length < 2) {
      throw new Error('A balanced journal entry must contain at least 2 line items.');
    }

    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    for (const line of data.lines) {
      totalDebit = totalDebit.plus(new Decimal(line.debit || 0));
      totalCredit = totalCredit.plus(new Decimal(line.credit || 0));
    }

    if (!totalDebit.equals(totalCredit)) {
      throw new Error(
        `Journal entry is unbalanced. Total Debit: Rs. ${totalDebit.toFixed(2)}, Total Credit: Rs. ${totalCredit.toFixed(2)}. Out of balance by: Rs. ${totalDebit.minus(totalCredit).abs().toFixed(2)}.`
      );
    }

    const jeId = `JE-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    return prisma.$transaction(async (tx) => {
      return tx.journalEntry.create({
        data: {
          id: jeId,
          date: data.date,
          description: data.description,
          reference: data.reference,
          totalDebit,
          totalCredit,
          createdBy: data.createdBy,
          lines: {
            create: data.lines.map((l) => ({
              accountName: l.accountName,
              debit: toDecimal(l.debit),
              credit: toDecimal(l.credit),
            })),
          },
        },
        include: { lines: true },
      });
    });
  }

  /**
   * Generates Financial Statements: Trial Balance and P&L
   */
  async getFinancialReports(branchId?: string) {
    const lines = await prisma.journalEntryLine.findMany({
      include: {
        journalEntry: true,
      },
    });

    const accountsMap: Record<string, { accountName: string; debitTotal: Decimal; creditTotal: Decimal; balance: Decimal }> = {};

    for (const l of lines) {
      const name = l.accountName;
      if (!accountsMap[name]) {
        accountsMap[name] = {
          accountName: name,
          debitTotal: new Decimal(0),
          creditTotal: new Decimal(0),
          balance: new Decimal(0),
        };
      }

      const d = new Decimal(l.debit.toString());
      const c = new Decimal(l.credit.toString());

      accountsMap[name].debitTotal = accountsMap[name].debitTotal.plus(d);
      accountsMap[name].creditTotal = accountsMap[name].creditTotal.plus(c);
      accountsMap[name].balance = accountsMap[name].debitTotal.minus(accountsMap[name].creditTotal);
    }

    const trialBalance = Object.values(accountsMap).map((a) => ({
      accountName: a.accountName,
      debit: a.debitTotal.toNumber(),
      credit: a.creditTotal.toNumber(),
      netBalance: a.balance.toNumber(),
    }));

    const totalDebits = trialBalance.reduce((sum, a) => sum + a.debit, 0);
    const totalCredits = trialBalance.reduce((sum, a) => sum + a.credit, 0);

    return {
      trialBalance,
      totals: {
        debits: totalDebits,
        credits: totalCredits,
        isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
      },
    };
  }
}

export const accountingService = new AccountingService();
