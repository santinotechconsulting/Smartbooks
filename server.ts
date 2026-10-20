import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { db } from './src/db/index.ts';
import {
  companies,
  users,
  accounts,
  journalEntries,
  journalLines,
  cashTransactions,
  customers,
  invoices,
  invoiceItems,
  suppliers,
  bills,
  billItems,
  products,
  inventoryMovements,
  fixedAssets,
  depreciationLogs,
  taxRates,
  bankReconciliations,
  employees,
  payrolls,
  payrollItems,
  budgets,
  auditLogs,
} from './src/db/schema.ts';
import {
  seedInitialDataIfNeeded,
  logAudit,
  roundToTwo,
} from './src/db/accounting.ts';
import { authenticateUser, AuthRequest } from './src/middleware/auth.ts';
import { eq, desc, and, gte, lte, sql, inArray } from 'drizzle-orm';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// Initialize seed data on startup
let activeCompanyId = 1;
seedInitialDataIfNeeded()
  .then((company) => {
    if (company) {
      activeCompanyId = company.id;
      console.log(`SmartBooks initialized with active company ID: ${activeCompanyId}`);
    }
  })
  .catch((err) => {
    console.error('Error during initial startup seeding:', err);
  });

// -------------------------------------------------------------
// 1. Current Session & Companies
// -------------------------------------------------------------
app.get('/api/auth/me', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const userRole = (req.headers['x-user-role'] as string) || 'super_admin';
    const allCompanies = await db.select().from(companies).orderBy(companies.id);
    const activeCompany = allCompanies.find((c) => c.id === activeCompanyId) || allCompanies[0];

    res.json({
      user: {
        uid: req.user?.uid || 'default-admin-uid',
        email: req.user?.email || 'admin@smartbooks.corp',
        name: req.user?.name || 'Senior Accountant',
        role: userRole,
      },
      activeCompany,
      availableCompanies: allCompanies,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to retrieve session' });
  }
});

app.get('/api/companies', authenticateUser, async (_req: AuthRequest, res: Response) => {
  try {
    const list = await db.select().from(companies).orderBy(companies.id);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/companies/switch', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId } = req.body;
    const target = await db.select().from(companies).where(eq(companies.id, Number(companyId))).limit(1);
    if (!target.length) {
      return res.status(404).json({ error: 'Company not found' });
    }
    activeCompanyId = target[0].id;
    res.json({ success: true, activeCompany: target[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/companies', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      tradingName,
      registrationNumber,
      taxId,
      address,
      city,
      country,
      phone,
      email,
      website,
      currency,
      currencySymbol,
      financialYearStart,
      financialYearEnd,
      accountingMethod,
      invoiceFormat,
      receiptFormat,
      journalFormat,
      documentFooter,
      authorisedSignatories,
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Company name is required' });

    const [created] = await db
      .insert(companies)
      .values({
        name,
        tradingName: tradingName || name,
        registrationNumber,
        taxId,
        address,
        city,
        country: country || 'United States',
        phone,
        email,
        website,
        currency: currency || 'USD',
        currencySymbol: currencySymbol || '$',
        financialYearStart: financialYearStart || '01-01',
        financialYearEnd: financialYearEnd || '12-31',
        accountingMethod: accountingMethod || 'ACCRUAL',
        invoiceFormat: invoiceFormat || 'INV-2026-{0000}',
        receiptFormat: receiptFormat || 'REC-2026-{0000}',
        journalFormat: journalFormat || 'JRN-2026-{0000}',
        documentFooter: documentFooter || 'Thank you for your business.',
        authorisedSignatories: authorisedSignatories || 'Managing Director',
      })
      .returning();

    // Auto-create standard chart of accounts for new company
    const standardAccounts = [
      { code: '1010', name: 'Cash on Hand', type: 'ASSET', category: 'Cash & Bank' },
      { code: '1030', name: 'Operating Bank Account', type: 'ASSET', category: 'Cash & Bank' },
      { code: '1200', name: 'Accounts Receivable', type: 'ASSET', category: 'Accounts Receivable' },
      { code: '1300', name: 'Merchandise Inventory', type: 'ASSET', category: 'Inventory' },
      { code: '1500', name: 'Office Equipment', type: 'ASSET', category: 'Fixed Assets' },
      { code: '2010', name: 'Accounts Payable', type: 'LIABILITY', category: 'Accounts Payable' },
      { code: '2040', name: 'VAT / Tax Payable', type: 'LIABILITY', category: 'Current Liabilities' },
      { code: '3010', name: "Owner's Capital", type: 'EQUITY', category: 'Equity' },
      { code: '4010', name: 'Sales Revenue', type: 'INCOME', category: 'Sales Revenue' },
      { code: '5010', name: 'Cost of Goods Sold', type: 'EXPENSE', category: 'Cost of Goods Sold' },
      { code: '5020', name: 'Salaries and Wages', type: 'EXPENSE', category: 'Operating Expenses' },
      { code: '5030', name: 'Rent Expense', type: 'EXPENSE', category: 'Operating Expenses' },
      { code: '5040', name: 'Utilities Expense', type: 'EXPENSE', category: 'Operating Expenses' },
    ];

    for (const acc of standardAccounts) {
      await db.insert(accounts).values({
        companyId: created.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        category: acc.category,
        isContra: false,
        isActive: true,
      });
    }

    await logAudit(
      created.id,
      req.user?.uid || 'user',
      req.user?.email || 'user@smartbooks.local',
      'CREATE',
      'COMPANY',
      String(created.id),
      `Registered company ${created.name}`
    );

    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/companies/:id', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updateData = req.body;
    delete updateData.id;

    const [updated] = await db
      .update(companies)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();

    await logAudit(
      id,
      req.user?.uid || 'user',
      req.user?.email || 'user@smartbooks.local',
      'UPDATE',
      'COMPANY',
      String(id),
      'Updated company profile & configurations'
    );

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 2. Chart of Accounts (with posted dynamic balances)
// -------------------------------------------------------------
app.get('/api/accounts', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = parseInt((req.query.companyId as string) || String(activeCompanyId), 10);
    const accountList = await db
      .select()
      .from(accounts)
      .where(eq(accounts.companyId, companyId))
      .orderBy(accounts.code);

    // Calculate live debits and credits from all posted journal entries
    const movementQuery = await db
      .select({
        accountId: journalLines.accountId,
        totalDebit: sql<string>`coalesce(sum(${journalLines.debit}), 0)`,
        totalCredit: sql<string>`coalesce(sum(${journalLines.credit}), 0)`,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalEntries.companyId, companyId),
          eq(journalEntries.status, 'posted'),
          eq(journalEntries.isReversed, false)
        )
      )
      .groupBy(journalLines.accountId);

    const movementsMap = new Map<number, { debit: number; credit: number }>();
    for (const row of movementQuery) {
      movementsMap.set(row.accountId, {
        debit: parseFloat(row.totalDebit),
        credit: parseFloat(row.totalCredit),
      });
    }

    const accountsWithBalances = accountList.map((acc) => {
      const mov = movementsMap.get(acc.id) || { debit: 0, credit: 0 };
      const opDebit = parseFloat(acc.openingDebit || '0');
      const opCredit = parseFloat(acc.openingCredit || '0');

      let balance = 0;
      // Normal balance: ASSET and EXPENSE = Debits - Credits
      // LIABILITY, EQUITY, INCOME = Credits - Debits
      if (acc.type === 'ASSET' || acc.type === 'EXPENSE') {
        balance = opDebit - opCredit + (mov.debit - mov.credit);
        if (acc.isContra) balance = -balance;
      } else {
        balance = opCredit - opDebit + (mov.credit - mov.debit);
        if (acc.isContra) balance = -balance;
      }

      return {
        ...acc,
        periodDebit: roundToTwo(mov.debit),
        periodCredit: roundToTwo(mov.credit),
        balance: roundToTwo(balance),
      };
    });

    res.json(accountsWithBalances);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/accounts', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, code, name, type, category, parentAccountId, isContra, description, openingDebit, openingCredit } = req.body;
    if (!code || !name || !type || !category) {
      return res.status(400).json({ error: 'Code, name, type, and category are required' });
    }

    const targetCompanyId = companyId || activeCompanyId;

    // Check duplicate code
    const existing = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.companyId, targetCompanyId), eq(accounts.code, code)))
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({ error: `Account with code ${code} already exists.` });
    }

    const [created] = await db
      .insert(accounts)
      .values({
        companyId: targetCompanyId,
        code,
        name,
        type,
        category,
        parentAccountId: parentAccountId ? parseInt(parentAccountId, 10) : null,
        isContra: !!isContra,
        isActive: true,
        description,
        openingDebit: openingDebit ? String(roundToTwo(parseFloat(openingDebit))) : '0.00',
        openingCredit: openingCredit ? String(roundToTwo(parseFloat(openingCredit))) : '0.00',
      })
      .returning();

    await logAudit(
      targetCompanyId,
      req.user?.uid || 'user',
      req.user?.email || 'user@smartbooks.local',
      'CREATE',
      'ACCOUNT',
      String(created.id),
      `Created account [${created.code}] ${created.name}`
    );

    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 3. Double-Entry General Journal
// -------------------------------------------------------------
app.get('/api/journals', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = parseInt((req.query.companyId as string) || String(activeCompanyId), 10);
    const { status, dateFrom, dateTo, search } = req.query;

    const entries = await db.query.journalEntries.findMany({
      where: (j, { eq, and, gte, lte, ilike }) => {
        const conditions = [eq(j.companyId, companyId)];
        if (status) conditions.push(eq(j.status, String(status)));
        if (dateFrom) conditions.push(gte(j.date, String(dateFrom)));
        if (dateTo) conditions.push(lte(j.date, String(dateTo)));
        if (search) conditions.push(ilike(j.description, `%${search}%`));
        return and(...conditions);
      },
      with: {
        lines: {
          with: {
            account: true,
          },
        },
      },
      orderBy: [desc(journalEntries.date), desc(journalEntries.id)],
    });

    res.json(entries);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/journals', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const {
      companyId,
      date,
      accountingPeriod,
      referenceNumber,
      sourceDocument,
      description,
      lines,
      status = 'posted',
    } = req.body;

    const targetCompanyId = companyId || activeCompanyId;

    if (!date || !description || !lines || !Array.isArray(lines) || lines.length < 2) {
      return res.status(400).json({
        error: 'A journal entry requires a date, description, and at least two balanced account lines.',
      });
    }

    // Strict Double-Entry Validation: DEBITS = CREDITS
    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of lines) {
      if (!line.accountId) {
        return res.status(400).json({ error: 'All journal lines must specify an account.' });
      }
      const deb = roundToTwo(parseFloat(line.debit || 0));
      const cred = roundToTwo(parseFloat(line.credit || 0));
      if (deb < 0 || cred < 0) {
        return res.status(400).json({ error: 'Journal line amounts cannot be negative.' });
      }
      if (deb > 0 && cred > 0) {
        return res.status(400).json({ error: 'A journal line cannot have both a debit and a credit amount.' });
      }
      totalDebit += deb;
      totalCredit += cred;
    }

    totalDebit = roundToTwo(totalDebit);
    totalCredit = roundToTwo(totalCredit);

    if (Math.abs(totalDebit - totalCredit) > 0.001 || totalDebit === 0) {
      return res.status(400).json({
        error: `Journal entry is out of balance! Total Debits ($${totalDebit.toFixed(2)}) must equal Total Credits ($${totalCredit.toFixed(2)}).`,
      });
    }

    // Generate Journal Number
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(journalEntries)
      .where(eq(journalEntries.companyId, targetCompanyId));

    const nextIndex = (countResult[0]?.count || 0) + 1;
    const journalNumber = `JRN-${date.slice(0, 4)}-${String(nextIndex).padStart(4, '0')}`;
    const period = accountingPeriod || date.slice(0, 7);

    const [entry] = await db
      .insert(journalEntries)
      .values({
        companyId: targetCompanyId,
        journalNumber,
        date,
        accountingPeriod: period,
        referenceNumber,
        sourceDocument: sourceDocument || 'General Journal',
        description,
        status,
        createdBy: req.user?.name || req.user?.email || 'Accountant',
        approvedBy: status === 'posted' ? req.user?.name || 'Authorized Officer' : null,
      })
      .returning();

    for (const line of lines) {
      await db.insert(journalLines).values({
        journalEntryId: entry.id,
        accountId: parseInt(line.accountId, 10),
        debit: String(roundToTwo(parseFloat(line.debit || 0))),
        credit: String(roundToTwo(parseFloat(line.credit || 0))),
        description: line.description || description,
      });
    }

    await logAudit(
      targetCompanyId,
      req.user?.uid || 'user',
      req.user?.email || 'user@smartbooks.local',
      'CREATE',
      'JOURNAL',
      String(entry.id),
      `Posted double-entry journal ${entry.journalNumber} ($${totalDebit.toFixed(2)})`
    );

    res.status(201).json(entry);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Reversal of Posted Journal (auditable reversal entry)
app.post('/api/journals/:id/reverse', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const originalEntry = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.id, id),
      with: { lines: true },
    });

    if (!originalEntry) return res.status(404).json({ error: 'Journal entry not found' });
    if (originalEntry.isReversed) {
      return res.status(400).json({ error: 'This journal entry has already been reversed.' });
    }

    const today = new Date().toISOString().slice(0, 10);
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(journalEntries)
      .where(eq(journalEntries.companyId, originalEntry.companyId));

    const nextIndex = (countResult[0]?.count || 0) + 1;
    const revJournalNumber = `REV-${today.slice(0, 4)}-${String(nextIndex).padStart(4, '0')}`;

    // Create auditable reversal entry with lines swapped: debits become credits, credits become debits!
    const [revEntry] = await db
      .insert(journalEntries)
      .values({
        companyId: originalEntry.companyId,
        journalNumber: revJournalNumber,
        date: today,
        accountingPeriod: today.slice(0, 7),
        referenceNumber: `REV-OF-${originalEntry.journalNumber}`,
        sourceDocument: `Reversal of ${originalEntry.journalNumber}`,
        description: `AUDIT REVERSAL: ${originalEntry.description}`,
        status: 'posted',
        createdBy: req.user?.name || req.user?.email || 'Auditor',
        approvedBy: req.user?.name || 'Chief Accountant',
        reversalOfId: originalEntry.id,
      })
      .returning();

    for (const l of originalEntry.lines) {
      await db.insert(journalLines).values({
        journalEntryId: revEntry.id,
        accountId: l.accountId,
        debit: l.credit, // SWAP
        credit: l.debit, // SWAP
        description: `Reversal: ${l.description || originalEntry.description}`,
      });
    }

    // Mark original as reversed
    await db
      .update(journalEntries)
      .set({ isReversed: true, updatedAt: new Date() })
      .where(eq(journalEntries.id, originalEntry.id));

    await logAudit(
      originalEntry.companyId,
      req.user?.uid || 'user',
      req.user?.email || 'user@smartbooks.local',
      'REVERSE',
      'JOURNAL',
      String(revEntry.id),
      `Reversed journal ${originalEntry.journalNumber} via ${revEntry.journalNumber}`
    );

    res.json({ success: true, reversalEntry: revEntry });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 4. Cash Book Management (Single, Double, Three-Column & Contra)
// -------------------------------------------------------------
app.get('/api/cash-book', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = parseInt((req.query.companyId as string) || String(activeCompanyId), 10);
    const { bookType = 'DOUBLE_COLUMN', accountId, dateFrom, dateTo } = req.query;

    const cashAccounts = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.companyId, companyId), eq(accounts.category, 'Cash & Bank')));

    const cashAcc = cashAccounts.find((a) => a.code === '1010') || cashAccounts[0];
    const bankAcc = cashAccounts.find((a) => a.code === '1030') || cashAccounts[1] || cashAcc;

    // Fetch cash transactions
    const txs = await db
      .select({
        id: cashTransactions.id,
        date: cashTransactions.date,
        voucherNumber: cashTransactions.voucherNumber,
        transactionType: cashTransactions.transactionType,
        bookType: cashTransactions.bookType,
        accountId: cashTransactions.accountId,
        contraAccountId: cashTransactions.contraAccountId,
        amount: cashTransactions.amount,
        discountAmount: cashTransactions.discountAmount,
        paymentMethod: cashTransactions.paymentMethod,
        referenceNumber: cashTransactions.referenceNumber,
        payerPayee: cashTransactions.payerPayee,
        description: cashTransactions.description,
        status: cashTransactions.status,
      })
      .from(cashTransactions)
      .where(
        and(
          eq(cashTransactions.companyId, companyId),
          dateFrom ? gte(cashTransactions.date, String(dateFrom)) : undefined,
          dateTo ? lte(cashTransactions.date, String(dateTo)) : undefined
        )
      )
      .orderBy(cashTransactions.date, cashTransactions.id);

    // Calculate running cash and bank balances
    let runningCash = parseFloat(cashAcc?.openingDebit || '0') - parseFloat(cashAcc?.openingCredit || '0');
    let runningBank = parseFloat(bankAcc?.openingDebit || '0') - parseFloat(bankAcc?.openingCredit || '0');

    const formattedTxs = txs.map((t) => {
      const amt = parseFloat(t.amount);
      const disc = parseFloat(t.discountAmount || '0');
      let cashReceipt = 0;
      let cashPayment = 0;
      let bankReceipt = 0;
      let bankPayment = 0;

      if (t.transactionType === 'CASH_RECEIPT') {
        cashReceipt = amt;
        runningCash += amt;
      } else if (t.transactionType === 'CASH_PAYMENT' || t.transactionType === 'PETTY_CASH') {
        cashPayment = amt;
        runningCash -= amt;
      } else if (t.transactionType === 'BANK_DEPOSIT') {
        bankReceipt = amt;
        runningBank += amt;
      } else if (t.transactionType === 'BANK_WITHDRAWAL') {
        bankPayment = amt;
        runningBank -= amt;
      } else if (t.transactionType === 'CONTRA_TRANSFER') {
        // Contra: Check direction
        if (t.accountId === cashAcc.id && t.contraAccountId === bankAcc.id) {
          // Cash to Bank deposit: Cash Payment, Bank Receipt
          cashPayment = amt;
          bankReceipt = amt;
          runningCash -= amt;
          runningBank += amt;
        } else {
          // Bank to Cash withdrawal: Bank Payment, Cash Receipt
          bankPayment = amt;
          cashReceipt = amt;
          runningBank -= amt;
          runningCash += amt;
        }
      }

      return {
        ...t,
        cashReceipt: roundToTwo(cashReceipt),
        cashPayment: roundToTwo(cashPayment),
        bankReceipt: roundToTwo(bankReceipt),
        bankPayment: roundToTwo(bankPayment),
        discount: roundToTwo(disc),
        runningCash: roundToTwo(runningCash),
        runningBank: roundToTwo(runningBank),
      };
    });

    res.json({
      bookType,
      cashAccount: cashAcc,
      bankAccount: bankAcc,
      openingCash: parseFloat(cashAcc?.openingDebit || '0'),
      openingBank: parseFloat(bankAcc?.openingDebit || '0'),
      closingCash: roundToTwo(runningCash),
      closingBank: roundToTwo(runningBank),
      transactions: formattedTxs,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Record Cash Receipt or Payment or Contra Voucher
app.post('/api/cash-book/entry', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const {
      companyId,
      transactionType, // CASH_RECEIPT, CASH_PAYMENT, BANK_DEPOSIT, BANK_WITHDRAWAL, CONTRA_TRANSFER, PETTY_CASH
      bookType = 'DOUBLE_COLUMN',
      date,
      accountId, // Cash or Bank Account
      targetAccountId, // Contra Account or Revenue/Expense Account
      amount,
      discountAmount = '0.00',
      paymentMethod = 'CASH',
      referenceNumber,
      payerPayee,
      description,
    } = req.body;

    const targetCompanyId = companyId || activeCompanyId;
    const numAmount = roundToTwo(parseFloat(amount));

    if (numAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than zero.' });
    }

    // Generate Voucher Number
    const voucherCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(cashTransactions)
      .where(eq(cashTransactions.companyId, targetCompanyId));

    const vNum = `${transactionType.slice(0, 3)}-${date.slice(0, 4)}-${String((voucherCount[0]?.count || 0) + 1).padStart(4, '0')}`;

    // Create corresponding balanced Journal Entry
    const jCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(journalEntries)
      .where(eq(journalEntries.companyId, targetCompanyId));

    const jNum = `JRN-${date.slice(0, 4)}-${String((jCount[0]?.count || 0) + 1).padStart(4, '0')}`;

    const [jEntry] = await db
      .insert(journalEntries)
      .values({
        companyId: targetCompanyId,
        journalNumber: jNum,
        date,
        accountingPeriod: date.slice(0, 7),
        referenceNumber: referenceNumber || vNum,
        sourceDocument: `Cash Book Voucher ${vNum}`,
        description: `[${transactionType}] ${payerPayee}: ${description}`,
        status: 'posted',
        createdBy: req.user?.name || req.user?.email || 'Cashier',
        approvedBy: req.user?.name || 'Accountant',
      })
      .returning();

    // Balanced double entry based on transactionType:
    if (transactionType === 'CASH_RECEIPT' || transactionType === 'BANK_DEPOSIT') {
      // Debit Cash/Bank, Credit Target Account (e.g. Sales Revenue or AR)
      await db.insert(journalLines).values([
        { journalEntryId: jEntry.id, accountId: parseInt(accountId, 10), debit: String(numAmount), credit: '0.00', description: `Receipt from ${payerPayee}` },
        { journalEntryId: jEntry.id, accountId: parseInt(targetAccountId, 10), debit: '0.00', credit: String(numAmount), description: `Account credited for receipt` },
      ]);
    } else if (transactionType === 'CASH_PAYMENT' || transactionType === 'BANK_WITHDRAWAL' || transactionType === 'PETTY_CASH') {
      // Debit Expense/Liability Account, Credit Cash/Bank
      await db.insert(journalLines).values([
        { journalEntryId: jEntry.id, accountId: parseInt(targetAccountId, 10), debit: String(numAmount), credit: '0.00', description: `Disbursement to ${payerPayee}` },
        { journalEntryId: jEntry.id, accountId: parseInt(accountId, 10), debit: '0.00', credit: String(numAmount), description: `Payment from cash/bank` },
      ]);
    } else if (transactionType === 'CONTRA_TRANSFER') {
      // Contra Internal Transfer: Debit Target Account, Credit Source Account
      await db.insert(journalLines).values([
        { journalEntryId: jEntry.id, accountId: parseInt(targetAccountId, 10), debit: String(numAmount), credit: '0.00', description: `Contra Transfer: Inward` },
        { journalEntryId: jEntry.id, accountId: parseInt(accountId, 10), debit: '0.00', credit: String(numAmount), description: `Contra Transfer: Outward` },
      ]);
    }

    // Insert Cash Book Transaction
    const [tx] = await db
      .insert(cashTransactions)
      .values({
        companyId: targetCompanyId,
        journalEntryId: jEntry.id,
        transactionType,
        bookType,
        voucherNumber: vNum,
        date,
        accountId: parseInt(accountId, 10),
        contraAccountId: targetAccountId ? parseInt(targetAccountId, 10) : null,
        amount: String(numAmount),
        discountAmount: String(roundToTwo(parseFloat(discountAmount))),
        paymentMethod,
        referenceNumber,
        payerPayee,
        description,
        status: 'posted',
        preparedBy: req.user?.name || 'Cashier',
        approvedBy: req.user?.name || 'Accountant',
      })
      .returning();

    await logAudit(
      targetCompanyId,
      req.user?.uid || 'user',
      req.user?.email || 'user@smartbooks.local',
      'CREATE',
      'CASH_BOOK',
      String(tx.id),
      `Recorded ${transactionType} ${vNum} for $${numAmount.toFixed(2)}`
    );

    res.status(201).json(tx);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 5. Sales & Invoicing
// -------------------------------------------------------------
app.get('/api/sales/customers', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = parseInt((req.query.companyId as string) || String(activeCompanyId), 10);
    const list = await db.select().from(customers).where(eq(customers.companyId, companyId)).orderBy(customers.name);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sales/customers', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, name, email, phone, address, taxNumber, creditLimit } = req.body;
    const targetCompanyId = companyId || activeCompanyId;

    const [cust] = await db
      .insert(customers)
      .values({
        companyId: targetCompanyId,
        name,
        email,
        phone,
        address,
        taxNumber,
        creditLimit: creditLimit ? String(roundToTwo(parseFloat(creditLimit))) : '0.00',
        openingBalance: '0.00',
        currentBalance: '0.00',
      })
      .returning();

    res.status(201).json(cust);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sales/invoices', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = parseInt((req.query.companyId as string) || String(activeCompanyId), 10);
    const list = await db.query.invoices.findMany({
      where: eq(invoices.companyId, companyId),
      with: {
        customer: true,
        items: true,
      },
      orderBy: [desc(invoices.date), desc(invoices.id)],
    });
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sales/invoices', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const {
      companyId,
      customerId,
      date,
      dueDate,
      type = 'CREDIT_SALE',
      paymentTerms = 'Net 30',
      notes,
      items,
      autoPost = true,
    } = req.body;

    const targetCompanyId = companyId || activeCompanyId;

    if (!customerId || !date || !items || !items.length) {
      return res.status(400).json({ error: 'Customer, date, and line items are required' });
    }

    let subtotal = 0;
    let taxAmount = 0;
    for (const item of items) {
      const q = parseFloat(item.quantity || 1);
      const p = parseFloat(item.unitPrice || 0);
      const taxRate = parseFloat(item.taxRate || 0);
      const lineSub = q * p;
      const lineTax = (lineSub * taxRate) / 100;
      subtotal += lineSub;
      taxAmount += lineTax;
    }
    const totalAmount = roundToTwo(subtotal + taxAmount);

    // Invoice numbering
    const invCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(eq(invoices.companyId, targetCompanyId));

    const invoiceNumber = `INV-${date.slice(0, 4)}-${String((invCount[0]?.count || 0) + 1).padStart(4, '0')}`;

    // Get company accounts
    const companyAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.companyId, targetCompanyId));

    const arAccount = companyAccounts.find((a) => a.code === '1200') || companyAccounts[0];
    const revAccount = companyAccounts.find((a) => a.code === '4010') || companyAccounts[0];
    const taxAccount = companyAccounts.find((a) => a.code === '2040') || companyAccounts[0];
    const bankAccount = companyAccounts.find((a) => a.code === '1030') || companyAccounts[0];

    let journalEntryId: number | null = null;
    if (autoPost) {
      const jCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(journalEntries)
        .where(eq(journalEntries.companyId, targetCompanyId));

      const jNum = `JRN-${date.slice(0, 4)}-${String((jCount[0]?.count || 0) + 1).padStart(4, '0')}`;

      const [jEntry] = await db
        .insert(journalEntries)
        .values({
          companyId: targetCompanyId,
          journalNumber: jNum,
          date,
          accountingPeriod: date.slice(0, 7),
          referenceNumber: invoiceNumber,
          sourceDocument: `Sales Invoice ${invoiceNumber}`,
          description: `Sales Invoice ${invoiceNumber}`,
          status: 'posted',
          createdBy: req.user?.name || 'Sales Officer',
          approvedBy: req.user?.name || 'Accountant',
        })
        .returning();

      journalEntryId = jEntry.id;

      // Double entry:
      // Debit: AR (Credit Sale) or Bank (Cash Sale)
      // Credit: Sales Revenue
      // Credit: VAT/Tax Payable
      const debitAccount = type === 'CASH_SALE' ? bankAccount.id : arAccount.id;

      await db.insert(journalLines).values([
        { journalEntryId: jEntry.id, accountId: debitAccount, debit: String(totalAmount), credit: '0.00', description: `Invoice ${invoiceNumber}` },
        { journalEntryId: jEntry.id, accountId: revAccount.id, debit: '0.00', credit: String(roundToTwo(subtotal)), description: `Sales Revenue` },
        ...(taxAmount > 0
          ? [{ journalEntryId: jEntry.id, accountId: taxAccount.id, debit: '0.00', credit: String(roundToTwo(taxAmount)), description: `Output Tax Payable` }]
          : []),
      ]);
    }

    const [inv] = await db
      .insert(invoices)
      .values({
        companyId: targetCompanyId,
        customerId: parseInt(customerId, 10),
        journalEntryId,
        invoiceNumber,
        date,
        dueDate: dueDate || date,
        status: type === 'CASH_SALE' ? 'paid' : 'sent',
        type,
        subtotal: String(roundToTwo(subtotal)),
        taxAmount: String(roundToTwo(taxAmount)),
        totalAmount: String(totalAmount),
        amountPaid: type === 'CASH_SALE' ? String(totalAmount) : '0.00',
        paymentTerms,
        notes,
      })
      .returning();

    for (const item of items) {
      await db.insert(invoiceItems).values({
        invoiceId: inv.id,
        productId: item.productId ? parseInt(item.productId, 10) : null,
        description: item.description,
        quantity: String(parseFloat(item.quantity || 1)),
        unitPrice: String(parseFloat(item.unitPrice || 0)),
        discount: '0.00',
        taxRate: String(parseFloat(item.taxRate || 0)),
        total: String(roundToTwo(parseFloat(item.quantity || 1) * parseFloat(item.unitPrice || 0))),
      });
    }

    // Update customer balance if credit sale
    if (type === 'CREDIT_SALE') {
      await db
        .update(customers)
        .set({ currentBalance: sql`${customers.currentBalance} + ${totalAmount}` })
        .where(eq(customers.id, parseInt(customerId, 10)));
    }

    await logAudit(
      targetCompanyId,
      req.user?.uid || 'user',
      req.user?.email || 'user@smartbooks.local',
      'CREATE',
      'INVOICE',
      String(inv.id),
      `Created Invoice ${invoiceNumber} for $${totalAmount.toFixed(2)}`
    );

    res.status(201).json(inv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Record Customer Payment against Invoice
app.post('/api/sales/invoices/:id/payment', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { amount, paymentMethod = 'BANK_TRANSFER', bankAccountId, date } = req.body;
    const paymentAmount = roundToTwo(parseFloat(amount));

    const inv = await db.query.invoices.findFirst({
      where: eq(invoices.id, id),
      with: { customer: true },
    });

    if (!inv) return res.status(404).json({ error: 'Invoice not found' });

    const newAmountPaid = roundToTwo(parseFloat(inv.amountPaid) + paymentAmount);
    const totalAmount = parseFloat(inv.totalAmount);
    const newStatus = newAmountPaid >= totalAmount ? 'paid' : 'partially_paid';

    // Update invoice
    await db
      .update(invoices)
      .set({
        amountPaid: String(newAmountPaid),
        status: newStatus,
      })
      .where(eq(invoices.id, id));

    // Update customer current balance
    await db
      .update(customers)
      .set({
        currentBalance: sql`${customers.currentBalance} - ${paymentAmount}`,
      })
      .where(eq(customers.id, inv.customerId));

    // Post double entry journal: Debit Bank Account, Credit Accounts Receivable
    const companyAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.companyId, inv.companyId));

    const bankAcc = companyAccounts.find((a) => a.id === parseInt(bankAccountId, 10)) || companyAccounts.find((a) => a.code === '1030') || companyAccounts[0];
    const arAcc = companyAccounts.find((a) => a.code === '1200') || companyAccounts[0];

    const payDate = date || new Date().toISOString().slice(0, 10);
    const jCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(journalEntries)
      .where(eq(journalEntries.companyId, inv.companyId));

    const [jEntry] = await db
      .insert(journalEntries)
      .values({
        companyId: inv.companyId,
        journalNumber: `JRN-${payDate.slice(0, 4)}-${String((jCount[0]?.count || 0) + 1).padStart(4, '0')}`,
        date: payDate,
        accountingPeriod: payDate.slice(0, 7),
        referenceNumber: `PAY-${inv.invoiceNumber}`,
        sourceDocument: `Customer Receipt ${inv.invoiceNumber}`,
        description: `Customer payment received for ${inv.invoiceNumber} from ${inv.customer.name}`,
        status: 'posted',
        createdBy: req.user?.name || 'Cashier',
        approvedBy: req.user?.name || 'Accountant',
      })
      .returning();

    await db.insert(journalLines).values([
      { journalEntryId: jEntry.id, accountId: bankAcc.id, debit: String(paymentAmount), credit: '0.00', description: `Payment deposited` },
      { journalEntryId: jEntry.id, accountId: arAcc.id, debit: '0.00', credit: String(paymentAmount), description: `AR settled for ${inv.invoiceNumber}` },
    ]);

    // Record in cash transactions
    await db.insert(cashTransactions).values({
      companyId: inv.companyId,
      journalEntryId: jEntry.id,
      transactionType: 'BANK_DEPOSIT',
      bookType: 'DOUBLE_COLUMN',
      voucherNumber: `REC-${payDate.slice(0, 4)}-${String(id).padStart(4, '0')}`,
      date: payDate,
      accountId: bankAcc.id,
      amount: String(paymentAmount),
      paymentMethod,
      referenceNumber: `INV-${inv.invoiceNumber}`,
      payerPayee: inv.customer.name,
      description: `Payment against Invoice ${inv.invoiceNumber}`,
      status: 'posted',
      preparedBy: req.user?.name || 'Cashier',
      approvedBy: req.user?.name || 'Accountant',
    });

    await logAudit(
      inv.companyId,
      req.user?.uid || 'user',
      req.user?.email || 'user@smartbooks.local',
      'UPDATE',
      'INVOICE',
      String(inv.id),
      `Customer payment of $${paymentAmount.toFixed(2)} received for ${inv.invoiceNumber}`
    );

    res.json({ success: true, newStatus, newAmountPaid });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 6. Purchases & Accounts Payable
// -------------------------------------------------------------
app.get('/api/purchases/suppliers', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = parseInt((req.query.companyId as string) || String(activeCompanyId), 10);
    const list = await db.select().from(suppliers).where(eq(suppliers.companyId, companyId)).orderBy(suppliers.name);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/purchases/suppliers', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, name, email, phone, address, taxNumber } = req.body;
    const targetCompanyId = companyId || activeCompanyId;

    const [supp] = await db
      .insert(suppliers)
      .values({
        companyId: targetCompanyId,
        name,
        email,
        phone,
        address,
        taxNumber,
        openingBalance: '0.00',
        currentBalance: '0.00',
      })
      .returning();

    res.status(201).json(supp);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/purchases/bills', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = parseInt((req.query.companyId as string) || String(activeCompanyId), 10);
    const list = await db.query.bills.findMany({
      where: eq(bills.companyId, companyId),
      with: {
        supplier: true,
        items: true,
      },
      orderBy: [desc(bills.date), desc(bills.id)],
    });
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/purchases/bills', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const {
      companyId,
      supplierId,
      billNumber,
      date,
      dueDate,
      type = 'CREDIT_PURCHASE',
      notes,
      items,
    } = req.body;

    const targetCompanyId = companyId || activeCompanyId;

    if (!supplierId || !billNumber || !date || !items || !items.length) {
      return res.status(400).json({ error: 'Supplier, bill number, date, and line items are required' });
    }

    let subtotal = 0;
    let taxAmount = 0;
    for (const item of items) {
      const q = parseFloat(item.quantity || 1);
      const c = parseFloat(item.unitCost || 0);
      const taxRate = parseFloat(item.taxRate || 0);
      const lineSub = q * c;
      const lineTax = (lineSub * taxRate) / 100;
      subtotal += lineSub;
      taxAmount += lineTax;
    }
    const totalAmount = roundToTwo(subtotal + taxAmount);

    // Accounts
    const companyAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.companyId, targetCompanyId));

    const apAccount = companyAccounts.find((a) => a.code === '2010') || companyAccounts[0];
    const defaultExpenseAccount = companyAccounts.find((a) => a.code === '5050') || companyAccounts[0];
    const bankAccount = companyAccounts.find((a) => a.code === '1030') || companyAccounts[0];

    // Double entry:
    // Debit: Relevant Expense / Inventory
    // Credit: Accounts Payable (Credit Purchase) or Bank (Cash Purchase)
    const jCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(journalEntries)
      .where(eq(journalEntries.companyId, targetCompanyId));

    const [jEntry] = await db
      .insert(journalEntries)
      .values({
        companyId: targetCompanyId,
        journalNumber: `JRN-${date.slice(0, 4)}-${String((jCount[0]?.count || 0) + 1).padStart(4, '0')}`,
        date,
        accountingPeriod: date.slice(0, 7),
        referenceNumber: billNumber,
        sourceDocument: `Supplier Bill ${billNumber}`,
        description: `Supplier bill from ${supplierId}: ${billNumber}`,
        status: 'posted',
        createdBy: req.user?.name || 'Purchasing Officer',
        approvedBy: req.user?.name || 'Accountant',
      })
      .returning();

    const creditAccountId = type === 'CASH_PURCHASE' ? bankAccount.id : apAccount.id;

    await db.insert(journalLines).values([
      { journalEntryId: jEntry.id, accountId: defaultExpenseAccount.id, debit: String(totalAmount), credit: '0.00', description: `Bill ${billNumber}` },
      { journalEntryId: jEntry.id, accountId: creditAccountId, debit: '0.00', credit: String(totalAmount), description: `Payable for ${billNumber}` },
    ]);

    const [b] = await db
      .insert(bills)
      .values({
        companyId: targetCompanyId,
        supplierId: parseInt(supplierId, 10),
        journalEntryId: jEntry.id,
        billNumber,
        date,
        dueDate: dueDate || date,
        status: type === 'CASH_PURCHASE' ? 'paid' : 'received',
        type,
        subtotal: String(roundToTwo(subtotal)),
        taxAmount: String(roundToTwo(taxAmount)),
        totalAmount: String(totalAmount),
        amountPaid: type === 'CASH_PURCHASE' ? String(totalAmount) : '0.00',
        notes,
      })
      .returning();

    for (const item of items) {
      await db.insert(billItems).values({
        billId: b.id,
        productId: item.productId ? parseInt(item.productId, 10) : null,
        expenseAccountId: defaultExpenseAccount.id,
        description: item.description,
        quantity: String(parseFloat(item.quantity || 1)),
        unitCost: String(parseFloat(item.unitCost || 0)),
        taxRate: String(parseFloat(item.taxRate || 0)),
        total: String(roundToTwo(parseFloat(item.quantity || 1) * parseFloat(item.unitCost || 0))),
      });
    }

    if (type === 'CREDIT_PURCHASE') {
      await db
        .update(suppliers)
        .set({ currentBalance: sql`${suppliers.currentBalance} + ${totalAmount}` })
        .where(eq(suppliers.id, parseInt(supplierId, 10)));
    }

    await logAudit(
      targetCompanyId,
      req.user?.uid || 'user',
      req.user?.email || 'user@smartbooks.local',
      'CREATE',
      'BILL',
      String(b.id),
      `Recorded supplier bill ${billNumber} for $${totalAmount.toFixed(2)}`
    );

    res.status(201).json(b);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 7. Inventory & Products
// -------------------------------------------------------------
app.get('/api/inventory/products', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = parseInt((req.query.companyId as string) || String(activeCompanyId), 10);
    const list = await db.select().from(products).where(eq(products.companyId, companyId)).orderBy(products.name);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/inventory/products', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const { companyId, code, name, category, unit, purchaseCost, sellingPrice, reorderLevel, quantityOnHand, costingMethod } = req.body;
    const targetCompanyId = companyId || activeCompanyId;

    const companyAccounts = await db.select().from(accounts).where(eq(accounts.companyId, targetCompanyId));
    const invAcc = companyAccounts.find((a) => a.code === '1300') || companyAccounts[0];
    const cogsAcc = companyAccounts.find((a) => a.code === '5010') || companyAccounts[0];
    const salesAcc = companyAccounts.find((a) => a.code === '4010') || companyAccounts[0];

    const [prod] = await db
      .insert(products)
      .values({
        companyId: targetCompanyId,
        code,
        name,
        category: category || 'General',
        unit: unit || 'unit',
        purchaseCost: String(roundToTwo(parseFloat(purchaseCost || 0))),
        sellingPrice: String(roundToTwo(parseFloat(sellingPrice || 0))),
        assetAccountId: invAcc.id,
        cogsAccountId: cogsAcc.id,
        incomeAccountId: salesAcc.id,
        reorderLevel: String(parseFloat(reorderLevel || 5)),
        quantityOnHand: String(parseFloat(quantityOnHand || 0)),
        costingMethod: costingMethod || 'FIFO',
      })
      .returning();

    res.status(201).json(prod);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 8. Fixed Assets & Depreciation
// -------------------------------------------------------------
app.get('/api/fixed-assets', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = parseInt((req.query.companyId as string) || String(activeCompanyId), 10);
    const list = await db.select().from(fixedAssets).where(eq(fixedAssets.companyId, companyId)).orderBy(fixedAssets.assetCode);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/fixed-assets/depreciate', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const { assetId, period, amount } = req.body;
    const depAmount = roundToTwo(parseFloat(amount));

    const asset = await db.query.fixedAssets.findFirst({
      where: eq(fixedAssets.id, parseInt(assetId, 10)),
    });

    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    const today = new Date().toISOString().slice(0, 10);
    const companyAccounts = await db.select().from(accounts).where(eq(accounts.companyId, asset.companyId));
    const depExpAcc = companyAccounts.find((a) => a.code === '5100') || companyAccounts[0];
    const accDepAcc = companyAccounts.find((a) => a.code === '1510') || companyAccounts[0];

    // Create journal entry: Debit Depreciation Expense, Credit Accumulated Depreciation
    const jCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(journalEntries)
      .where(eq(journalEntries.companyId, asset.companyId));

    const [jEntry] = await db
      .insert(journalEntries)
      .values({
        companyId: asset.companyId,
        journalNumber: `JRN-${today.slice(0, 4)}-${String((jCount[0]?.count || 0) + 1).padStart(4, '0')}`,
        date: today,
        accountingPeriod: period || today.slice(0, 7),
        referenceNumber: `DEP-${asset.assetCode}`,
        sourceDocument: `Depreciation Schedule ${asset.assetCode}`,
        description: `Depreciation for ${asset.name} (${asset.assetCode}) - ${period}`,
        status: 'posted',
        createdBy: req.user?.name || 'Accountant',
        approvedBy: req.user?.name || 'Chief Accountant',
      })
      .returning();

    await db.insert(journalLines).values([
      { journalEntryId: jEntry.id, accountId: depExpAcc.id, debit: String(depAmount), credit: '0.00', description: `Depreciation expense` },
      { journalEntryId: jEntry.id, accountId: accDepAcc.id, debit: '0.00', credit: String(depAmount), description: `Accumulated depreciation` },
    ]);

    // Update asset
    const newAccDep = roundToTwo(parseFloat(asset.accumulatedDepreciation) + depAmount);
    const newNbv = roundToTwo(parseFloat(asset.acquisitionCost) - newAccDep);

    await db
      .update(fixedAssets)
      .set({
        accumulatedDepreciation: String(newAccDep),
        netBookValue: String(newNbv),
      })
      .where(eq(fixedAssets.id, asset.id));

    await db.insert(depreciationLogs).values({
      assetId: asset.id,
      period: period || today.slice(0, 7),
      date: today,
      amount: String(depAmount),
      journalEntryId: jEntry.id,
    });

    await logAudit(
      asset.companyId,
      req.user?.uid || 'user',
      req.user?.email || 'user@smartbooks.local',
      'POST',
      'DEPRECIATION',
      String(asset.id),
      `Posted depreciation $${depAmount.toFixed(2)} for ${asset.name}`
    );

    res.json({ success: true, newAccumulatedDepreciation: newAccDep, newNetBookValue: newNbv });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 9. Bank Reconciliation
// -------------------------------------------------------------
app.get('/api/bank-reconciliations', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = parseInt((req.query.companyId as string) || String(activeCompanyId), 10);
    const list = await db.select().from(bankReconciliations).where(eq(bankReconciliations.companyId, companyId)).orderBy(desc(bankReconciliations.statementDate));
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bank-reconciliations', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const {
      companyId,
      accountId,
      statementDate,
      statementEndingBalance,
      depositsInTransit = '0.00',
      outstandingCheques = '0.00',
      bankCharges = '0.00',
      bankInterest = '0.00',
    } = req.body;

    const targetCompanyId = companyId || activeCompanyId;

    // Fetch cash book running bank balance
    const bankAcc = await db.query.accounts.findFirst({
      where: eq(accounts.id, parseInt(accountId, 10)),
    });

    if (!bankAcc) return res.status(404).json({ error: 'Bank account not found' });

    // Calculate book balance
    const mov = await db
      .select({
        debit: sql<string>`coalesce(sum(${journalLines.debit}), 0)`,
        credit: sql<string>`coalesce(sum(${journalLines.credit}), 0)`,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalEntries.companyId, targetCompanyId),
          eq(journalEntries.status, 'posted'),
          eq(journalEntries.isReversed, false),
          eq(journalLines.accountId, bankAcc.id)
        )
      );

    const bookBalance = roundToTwo(parseFloat(mov[0]?.debit || '0') - parseFloat(mov[0]?.credit || '0'));
    const stmtEnd = roundToTwo(parseFloat(statementEndingBalance));
    const depTransit = roundToTwo(parseFloat(depositsInTransit));
    const outCheques = roundToTwo(parseFloat(outstandingCheques));
    const charges = roundToTwo(parseFloat(bankCharges));
    const interest = roundToTwo(parseFloat(bankInterest));

    // Adjusted Bank Balance = Statement Ending + Deposits in Transit - Outstanding Cheques
    const adjustedBankBalance = roundToTwo(stmtEnd + depTransit - outCheques);

    // Adjusted Book Balance = Book Balance + Interest - Charges
    const adjustedBookBalance = roundToTwo(bookBalance + interest - charges);

    const difference = roundToTwo(adjustedBankBalance - adjustedBookBalance);

    const [rec] = await db
      .insert(bankReconciliations)
      .values({
        companyId: targetCompanyId,
        accountId: bankAcc.id,
        statementDate,
        statementEndingBalance: String(stmtEnd),
        bookBalance: String(bookBalance),
        depositsInTransit: String(depTransit),
        outstandingCheques: String(outCheques),
        bankCharges: String(charges),
        bankInterest: String(interest),
        adjustedBankBalance: String(adjustedBankBalance),
        adjustedBookBalance: String(adjustedBookBalance),
        difference: String(difference),
        status: Math.abs(difference) < 0.01 ? 'completed' : 'in_progress',
        completedAt: Math.abs(difference) < 0.01 ? new Date() : null,
      })
      .returning();

    res.status(201).json(rec);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 10. Financial Statements & Reporting Engine
// -------------------------------------------------------------

// A. TRIAL BALANCE (Unadjusted and Adjusted with Debit/Credit Check)
app.get('/api/reports/trial-balance', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = parseInt((req.query.companyId as string) || String(activeCompanyId), 10);
    const { asOfDate } = req.query;

    const allAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.companyId, companyId))
      .orderBy(accounts.code);

    const movements = await db
      .select({
        accountId: journalLines.accountId,
        totalDebit: sql<string>`coalesce(sum(${journalLines.debit}), 0)`,
        totalCredit: sql<string>`coalesce(sum(${journalLines.credit}), 0)`,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalEntries.companyId, companyId),
          eq(journalEntries.status, 'posted'),
          eq(journalEntries.isReversed, false),
          asOfDate ? lte(journalEntries.date, String(asOfDate)) : undefined
        )
      )
      .groupBy(journalLines.accountId);

    const map = new Map<number, { debit: number; credit: number }>();
    for (const m of movements) {
      map.set(m.accountId, { debit: parseFloat(m.totalDebit), credit: parseFloat(m.totalCredit) });
    }

    let grandTotalDebit = 0;
    let grandTotalCredit = 0;

    const rows = allAccounts.map((acc) => {
      const mov = map.get(acc.id) || { debit: 0, credit: 0 };
      const opDebit = parseFloat(acc.openingDebit || '0');
      const opCredit = parseFloat(acc.openingCredit || '0');

      const netDebit = roundToTwo(opDebit + mov.debit);
      const netCredit = roundToTwo(opCredit + mov.credit);

      let closingDebit = 0;
      let closingCredit = 0;

      if (netDebit >= netCredit) {
        closingDebit = roundToTwo(netDebit - netCredit);
      } else {
        closingCredit = roundToTwo(netCredit - netDebit);
      }

      grandTotalDebit += closingDebit;
      grandTotalCredit += closingCredit;

      return {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        category: acc.category,
        periodDebit: roundToTwo(mov.debit),
        periodCredit: roundToTwo(mov.credit),
        closingDebit,
        closingCredit,
      };
    });

    grandTotalDebit = roundToTwo(grandTotalDebit);
    grandTotalCredit = roundToTwo(grandTotalCredit);
    const isBalanced = Math.abs(grandTotalDebit - grandTotalCredit) < 0.01;

    res.json({
      asOfDate: asOfDate || new Date().toISOString().slice(0, 10),
      grandTotalDebit,
      grandTotalCredit,
      isBalanced,
      difference: roundToTwo(grandTotalDebit - grandTotalCredit),
      rows,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// B. INCOME STATEMENT (Statement of Profit or Loss)
app.get('/api/reports/income-statement', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = parseInt((req.query.companyId as string) || String(activeCompanyId), 10);
    const { startDate, endDate } = req.query;

    const incomeAccounts = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.companyId, companyId), inArray(accounts.type, ['INCOME', 'EXPENSE'])))
      .orderBy(accounts.code);

    const movements = await db
      .select({
        accountId: journalLines.accountId,
        totalDebit: sql<string>`coalesce(sum(${journalLines.debit}), 0)`,
        totalCredit: sql<string>`coalesce(sum(${journalLines.credit}), 0)`,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalEntries.companyId, companyId),
          eq(journalEntries.status, 'posted'),
          eq(journalEntries.isReversed, false),
          startDate ? gte(journalEntries.date, String(startDate)) : undefined,
          endDate ? lte(journalEntries.date, String(endDate)) : undefined
        )
      )
      .groupBy(journalLines.accountId);

    const map = new Map<number, { debit: number; credit: number }>();
    for (const m of movements) {
      map.set(m.accountId, { debit: parseFloat(m.totalDebit), credit: parseFloat(m.totalCredit) });
    }

    const revenues: any[] = [];
    const cogs: any[] = [];
    const operatingExpenses: any[] = [];
    const financeCosts: any[] = [];

    let totalRevenue = 0;
    let totalCogs = 0;
    let totalOpEx = 0;
    let totalFinance = 0;

    for (const acc of incomeAccounts) {
      const mov = map.get(acc.id) || { debit: 0, credit: 0 };
      if (acc.type === 'INCOME') {
        const amt = roundToTwo(mov.credit - mov.debit);
        if (amt !== 0) {
          revenues.push({ ...acc, amount: amt });
          totalRevenue += amt;
        }
      } else if (acc.type === 'EXPENSE') {
        const amt = roundToTwo(mov.debit - mov.credit);
        if (amt !== 0) {
          if (acc.category === 'Cost of Goods Sold') {
            cogs.push({ ...acc, amount: amt });
            totalCogs += amt;
          } else if (acc.category === 'Finance Costs') {
            financeCosts.push({ ...acc, amount: amt });
            totalFinance += amt;
          } else {
            operatingExpenses.push({ ...acc, amount: amt });
            totalOpEx += amt;
          }
        }
      }
    }

    totalRevenue = roundToTwo(totalRevenue);
    totalCogs = roundToTwo(totalCogs);
    const grossProfit = roundToTwo(totalRevenue - totalCogs);
    totalOpEx = roundToTwo(totalOpEx);
    const operatingProfit = roundToTwo(grossProfit - totalOpEx);
    totalFinance = roundToTwo(totalFinance);
    const profitBeforeTax = roundToTwo(operatingProfit - totalFinance);
    const taxExpense = roundToTwo(profitBeforeTax > 0 ? profitBeforeTax * 0.15 : 0);
    const netProfitOrLoss = roundToTwo(profitBeforeTax - taxExpense);

    res.json({
      startDate: startDate || '2026-01-01',
      endDate: endDate || new Date().toISOString().slice(0, 10),
      revenues,
      totalRevenue,
      cogs,
      totalCogs,
      grossProfit,
      operatingExpenses,
      totalOperatingExpenses: totalOpEx,
      operatingProfit,
      financeCosts,
      totalFinanceCosts: totalFinance,
      profitBeforeTax,
      taxExpense,
      netProfitOrLoss,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// C. STATEMENT OF FINANCIAL POSITION (Balance Sheet: Assets = Liabilities + Equity)
app.get('/api/reports/balance-sheet', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = parseInt((req.query.companyId as string) || String(activeCompanyId), 10);
    const { asOfDate } = req.query;

    const bsAccounts = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.companyId, companyId), inArray(accounts.type, ['ASSET', 'LIABILITY', 'EQUITY'])))
      .orderBy(accounts.code);

    const movements = await db
      .select({
        accountId: journalLines.accountId,
        totalDebit: sql<string>`coalesce(sum(${journalLines.debit}), 0)`,
        totalCredit: sql<string>`coalesce(sum(${journalLines.credit}), 0)`,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalEntries.companyId, companyId),
          eq(journalEntries.status, 'posted'),
          eq(journalEntries.isReversed, false),
          asOfDate ? lte(journalEntries.date, String(asOfDate)) : undefined
        )
      )
      .groupBy(journalLines.accountId);

    const map = new Map<number, { debit: number; credit: number }>();
    for (const m of movements) {
      map.set(m.accountId, { debit: parseFloat(m.totalDebit), credit: parseFloat(m.totalCredit) });
    }

    // Calculate current net profit or loss from Income & Expense accounts
    const pnlMovements = await db
      .select({
        type: accounts.type,
        debit: sql<string>`coalesce(sum(${journalLines.debit}), 0)`,
        credit: sql<string>`coalesce(sum(${journalLines.credit}), 0)`,
      })
      .from(journalLines)
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalEntries.companyId, companyId),
          eq(journalEntries.status, 'posted'),
          eq(journalEntries.isReversed, false),
          inArray(accounts.type, ['INCOME', 'EXPENSE']),
          asOfDate ? lte(journalEntries.date, String(asOfDate)) : undefined
        )
      )
      .groupBy(accounts.type);

    let incCredit = 0;
    let incDebit = 0;
    let expDebit = 0;
    let expCredit = 0;

    for (const p of pnlMovements) {
      if (p.type === 'INCOME') {
        incCredit += parseFloat(p.credit);
        incDebit += parseFloat(p.debit);
      } else {
        expDebit += parseFloat(p.debit);
        expCredit += parseFloat(p.credit);
      }
    }
    const currentPeriodEarnings = roundToTwo(incCredit - incDebit - (expDebit - expCredit));

    const currentAssets: any[] = [];
    const nonCurrentAssets: any[] = [];
    const currentLiabilities: any[] = [];
    const nonCurrentLiabilities: any[] = [];
    const equityItems: any[] = [];

    let totalCurrentAssets = 0;
    let totalNonCurrentAssets = 0;
    let totalCurrentLiabilities = 0;
    let totalNonCurrentLiabilities = 0;
    let totalEquity = 0;

    for (const acc of bsAccounts) {
      const mov = map.get(acc.id) || { debit: 0, credit: 0 };
      const opDebit = parseFloat(acc.openingDebit || '0');
      const opCredit = parseFloat(acc.openingCredit || '0');

      if (acc.type === 'ASSET') {
        let bal = roundToTwo(opDebit - opCredit + (mov.debit - mov.credit));
        if (acc.isContra) bal = -bal;
        if (bal !== 0 || acc.category === 'Cash & Bank') {
          if (acc.category === 'Fixed Assets') {
            nonCurrentAssets.push({ ...acc, balance: bal });
            totalNonCurrentAssets += bal;
          } else {
            currentAssets.push({ ...acc, balance: bal });
            totalCurrentAssets += bal;
          }
        }
      } else if (acc.type === 'LIABILITY') {
        let bal = roundToTwo(opCredit - opDebit + (mov.credit - mov.debit));
        if (acc.isContra) bal = -bal;
        if (bal !== 0 || acc.category === 'Accounts Payable') {
          if (acc.category === 'Long Term Liabilities') {
            nonCurrentLiabilities.push({ ...acc, balance: bal });
            totalNonCurrentLiabilities += bal;
          } else {
            currentLiabilities.push({ ...acc, balance: bal });
            totalCurrentLiabilities += bal;
          }
        }
      } else if (acc.type === 'EQUITY') {
        let bal = roundToTwo(opCredit - opDebit + (mov.credit - mov.debit));
        if (acc.isContra) bal = -bal;
        equityItems.push({ ...acc, balance: bal });
        totalEquity += bal;
      }
    }

    // Add current period earnings into equity
    totalEquity = roundToTwo(totalEquity + currentPeriodEarnings);

    const totalAssets = roundToTwo(totalCurrentAssets + totalNonCurrentAssets);
    const totalLiabilities = roundToTwo(totalCurrentLiabilities + totalNonCurrentLiabilities);
    const totalLiabilitiesAndEquity = roundToTwo(totalLiabilities + totalEquity);

    const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;
    const difference = roundToTwo(totalAssets - totalLiabilitiesAndEquity);

    res.json({
      asOfDate: asOfDate || new Date().toISOString().slice(0, 10),
      currentAssets,
      totalCurrentAssets: roundToTwo(totalCurrentAssets),
      nonCurrentAssets,
      totalNonCurrentAssets: roundToTwo(totalNonCurrentAssets),
      totalAssets,
      currentLiabilities,
      totalCurrentLiabilities: roundToTwo(totalCurrentLiabilities),
      nonCurrentLiabilities,
      totalNonCurrentLiabilities: roundToTwo(totalNonCurrentLiabilities),
      totalLiabilities,
      equityItems,
      currentPeriodEarnings,
      totalEquity,
      totalLiabilitiesAndEquity,
      isBalanced,
      difference,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// D. CASH FLOW STATEMENT
app.get('/api/reports/cash-flow', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = parseInt((req.query.companyId as string) || String(activeCompanyId), 10);
    const { startDate, endDate } = req.query;

    const cashAccounts = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.companyId, companyId), eq(accounts.category, 'Cash & Bank')));

    const cashAccountIds = cashAccounts.map((a) => a.id);

    // Fetch cash transactions
    const txs = await db
      .select()
      .from(cashTransactions)
      .where(
        and(
          eq(cashTransactions.companyId, companyId),
          startDate ? gte(cashTransactions.date, String(startDate)) : undefined,
          endDate ? lte(cashTransactions.date, String(endDate)) : undefined
        )
      );

    let operatingCashFlow = 0;
    let investingCashFlow = 0;
    let financingCashFlow = 0;

    const operatingLines: any[] = [];
    const investingLines: any[] = [];
    const financingLines: any[] = [];

    for (const t of txs) {
      if (t.transactionType === 'CONTRA_TRANSFER') {
        // Internal transfer between own accounts: excluded from cash flow per specs!
        continue;
      }
      const amt = parseFloat(t.amount);
      if (t.transactionType === 'CASH_RECEIPT' || t.transactionType === 'BANK_DEPOSIT') {
        operatingCashFlow += amt;
        operatingLines.push({ description: `Receipt: ${t.payerPayee} (${t.description})`, amount: amt });
      } else if (t.transactionType === 'CASH_PAYMENT' || t.transactionType === 'BANK_WITHDRAWAL' || t.transactionType === 'PETTY_CASH') {
        operatingCashFlow -= amt;
        operatingLines.push({ description: `Disbursement: ${t.payerPayee} (${t.description})`, amount: -amt });
      }
    }

    const netChangeInCash = roundToTwo(operatingCashFlow + investingCashFlow + financingCashFlow);

    res.json({
      startDate: startDate || '2026-01-01',
      endDate: endDate || new Date().toISOString().slice(0, 10),
      operatingActivities: operatingLines,
      totalOperating: roundToTwo(operatingCashFlow),
      investingActivities: investingLines,
      totalInvesting: roundToTwo(investingCashFlow),
      financingActivities: financingLines,
      totalFinancing: roundToTwo(financingCashFlow),
      netChangeInCash,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// E. GENERAL LEDGER (Account Drilldown)
app.get('/api/reports/general-ledger/:accountId', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const accountId = parseInt(req.params.accountId, 10);
    const { startDate, endDate } = req.query;

    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });

    if (!account) return res.status(404).json({ error: 'Account not found' });

    const lines = await db
      .select({
        lineId: journalLines.id,
        journalId: journalEntries.id,
        journalNumber: journalEntries.journalNumber,
        date: journalEntries.date,
        sourceDocument: journalEntries.sourceDocument,
        referenceNumber: journalEntries.referenceNumber,
        description: journalLines.description,
        debit: journalLines.debit,
        credit: journalLines.credit,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalLines.accountId, accountId),
          eq(journalEntries.status, 'posted'),
          eq(journalEntries.isReversed, false),
          startDate ? gte(journalEntries.date, String(startDate)) : undefined,
          endDate ? lte(journalEntries.date, String(endDate)) : undefined
        )
      )
      .orderBy(journalEntries.date, journalEntries.id);

    let runningBalance = parseFloat(account.openingDebit || '0') - parseFloat(account.openingCredit || '0');
    if (account.type === 'LIABILITY' || account.type === 'EQUITY' || account.type === 'INCOME') {
      runningBalance = -runningBalance;
    }

    const ledgerRows = lines.map((l) => {
      const d = parseFloat(l.debit);
      const c = parseFloat(l.credit);
      if (account.type === 'ASSET' || account.type === 'EXPENSE') {
        runningBalance += d - c;
      } else {
        runningBalance += c - d;
      }
      return {
        ...l,
        debit: roundToTwo(d),
        credit: roundToTwo(c),
        runningBalance: roundToTwo(runningBalance),
      };
    });

    res.json({
      account,
      openingBalance: parseFloat(account.openingDebit || '0'),
      closingBalance: roundToTwo(runningBalance),
      rows: ledgerRows,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 11. Audit Logs
// -------------------------------------------------------------
app.get('/api/audit-logs', authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const companyId = parseInt((req.query.companyId as string) || String(activeCompanyId), 10);
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.companyId, companyId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// Vite Middleware / Static Files Serving
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SmartBooks Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
