import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { db } from './index.ts';
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
} from './schema.ts';

// Helper for decimal arithmetic precision
export function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(amount: number | string, symbol = '$'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return `${symbol}0.00`;
  const formatted = Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return num < 0 ? `(${symbol}${formatted})` : `${symbol}${formatted}`;
}

// 1. Audit Logging
export async function logAudit(
  companyId: number,
  userId: string,
  userEmail: string,
  action: string,
  entityType: string,
  entityId: string,
  details: string
) {
  try {
    await db.insert(auditLogs).values({
      companyId,
      userId,
      userEmail,
      action,
      entityType,
      entityId,
      details,
    });
  } catch (err) {
    console.error('Audit logging failed:', err);
  }
}

// 2. Database Seeder
export async function seedInitialDataIfNeeded() {
  try {
    const existingCompanies = await db.select().from(companies).limit(1);
    if (existingCompanies.length > 0) {
      return existingCompanies[0];
    }

    console.log('Seeding initial SmartBooks accounting company and records...');

    // A. Create Company
    const [company] = await db
      .insert(companies)
      .values({
        name: 'Apex Global Technologies Inc.',
        tradingName: 'Apex Technologies',
        registrationNumber: 'CORP-2024-98432',
        taxId: 'US-TAX-8890214',
        address: '450 Silicon Boulevard, Suite 800',
        city: 'San Francisco, CA',
        country: 'United States',
        phone: '+1 (415) 890-4321',
        email: 'finance@apextechnologies.io',
        website: 'https://apextechnologies.io',
        currency: 'USD',
        currencySymbol: '$',
        financialYearStart: '01-01',
        financialYearEnd: '12-31',
        accountingMethod: 'ACCRUAL',
        invoiceFormat: 'INV-2026-{0000}',
        receiptFormat: 'REC-2026-{0000}',
        journalFormat: 'JRN-2026-{0000}',
        documentFooter: 'Thank you for your business. Certified double-entry records.',
        authorisedSignatories: 'Eleanor Vance (Chief Financial Officer), Marcus Brody (Managing Director)',
      })
      .returning();

    // B. Default Tax Rates
    await db.insert(taxRates).values([
      { companyId: company.id, name: 'Standard VAT / Sales Tax', code: 'VAT15', rate: '15.00', type: 'VAT', isActive: true },
      { companyId: company.id, name: 'Reduced Rate', code: 'RED5', rate: '5.00', type: 'VAT', isActive: true },
      { companyId: company.id, name: 'Zero-Rated Supplies', code: 'ZERO0', rate: '0.00', type: 'ZERO_RATED', isActive: true },
      { companyId: company.id, name: 'Exempt', code: 'EXEMPT', rate: '0.00', type: 'EXEMPT', isActive: true },
    ]);

    // C. Default Chart of Accounts
    const defaultAccounts = [
      // Assets
      { code: '1010', name: 'Cash on Hand', type: 'ASSET', category: 'Cash & Bank' },
      { code: '1020', name: 'Petty Cash', type: 'ASSET', category: 'Cash & Bank' },
      { code: '1030', name: 'Operating Bank Account', type: 'ASSET', category: 'Cash & Bank' },
      { code: '1040', name: 'Savings & Reserve Account', type: 'ASSET', category: 'Cash & Bank' },
      { code: '1200', name: 'Accounts Receivable', type: 'ASSET', category: 'Accounts Receivable' },
      { code: '1300', name: 'Merchandise Inventory', type: 'ASSET', category: 'Inventory' },
      { code: '1400', name: 'Prepaid Expenses', type: 'ASSET', category: 'Current Assets' },
      { code: '1500', name: 'Computer & Office Equipment', type: 'ASSET', category: 'Fixed Assets' },
      { code: '1510', name: 'Accumulated Depreciation - Equipment', type: 'ASSET', category: 'Fixed Assets', isContra: true },
      { code: '1520', name: 'Office Furniture & Fixtures', type: 'ASSET', category: 'Fixed Assets' },
      { code: '1530', name: 'Company Vehicles', type: 'ASSET', category: 'Fixed Assets' },
      { code: '1540', name: 'Accumulated Depreciation - Vehicles', type: 'ASSET', category: 'Fixed Assets', isContra: true },

      // Liabilities
      { code: '2010', name: 'Accounts Payable', type: 'LIABILITY', category: 'Accounts Payable' },
      { code: '2020', name: 'Accrued Operating Expenses', type: 'LIABILITY', category: 'Current Liabilities' },
      { code: '2030', name: 'Salaries & Wages Payable', type: 'LIABILITY', category: 'Current Liabilities' },
      { code: '2040', name: 'Sales Tax / VAT Payable', type: 'LIABILITY', category: 'Current Liabilities' },
      { code: '2100', name: 'Short-Term Commercial Loan', type: 'LIABILITY', category: 'Current Liabilities' },
      { code: '2200', name: 'Long-Term Bank Debt', type: 'LIABILITY', category: 'Long Term Liabilities' },

      // Equity
      { code: '3010', name: "Owner's / Share Capital", type: 'EQUITY', category: 'Equity' },
      { code: '3020', name: 'Retained Earnings', type: 'EQUITY', category: 'Equity' },
      { code: '3030', name: 'Dividends & Drawings', type: 'EQUITY', category: 'Equity', isContra: true },
      { code: '3040', name: 'Current-Year Net Earnings', type: 'EQUITY', category: 'Equity' },

      // Income
      { code: '4010', name: 'Sales Revenue - Products', type: 'INCOME', category: 'Sales Revenue' },
      { code: '4020', name: 'Professional Services Revenue', type: 'INCOME', category: 'Sales Revenue' },
      { code: '4030', name: 'Interest & Finance Income', type: 'INCOME', category: 'Other Income' },
      { code: '4090', name: 'Sales Returns & Discounts', type: 'INCOME', category: 'Sales Revenue', isContra: true },

      // Expenses
      { code: '5010', name: 'Cost of Goods Sold (COGS)', type: 'EXPENSE', category: 'Cost of Goods Sold' },
      { code: '5020', name: 'Salaries and Wages Expense', type: 'EXPENSE', category: 'Operating Expenses' },
      { code: '5030', name: 'Office Rent & Facilities', type: 'EXPENSE', category: 'Operating Expenses' },
      { code: '5040', name: 'Utilities & Power Expense', type: 'EXPENSE', category: 'Operating Expenses' },
      { code: '5050', name: 'Office Supplies & Software', type: 'EXPENSE', category: 'Operating Expenses' },
      { code: '5060', name: 'Freight & Transportation', type: 'EXPENSE', category: 'Operating Expenses' },
      { code: '5070', name: 'Advertising & Marketing', type: 'EXPENSE', category: 'Operating Expenses' },
      { code: '5080', name: 'Repairs & Maintenance', type: 'EXPENSE', category: 'Operating Expenses' },
      { code: '5090', name: 'Commercial Insurance', type: 'EXPENSE', category: 'Operating Expenses' },
      { code: '5100', name: 'Depreciation Expense', type: 'EXPENSE', category: 'Operating Expenses' },
      { code: '5110', name: 'Bank & Processing Fees', type: 'EXPENSE', category: 'Finance Costs' },
      { code: '5120', name: 'Miscellaneous Expenses', type: 'EXPENSE', category: 'Operating Expenses' },
    ];

    const accountMap: Record<string, number> = {};
    for (const acc of defaultAccounts) {
      const [inserted] = await db
        .insert(accounts)
        .values({
          companyId: company.id,
          code: acc.code,
          name: acc.name,
          type: acc.type,
          category: acc.category,
          isContra: acc.isContra || false,
          isActive: true,
          description: `Standard Chart of Accounts: ${acc.name}`,
        })
        .returning();
      accountMap[acc.code] = inserted.id;
    }

    // D. Initial Customers
    const [cust1] = await db
      .insert(customers)
      .values({
        companyId: company.id,
        name: 'Nexus Corp Solutions',
        email: 'accounts@nexuscorp.com',
        phone: '+1 (555) 234-5678',
        address: '100 Market St, San Francisco, CA',
        taxNumber: 'US-CUST-9921',
        creditLimit: '25000.00',
        currentBalance: '6400.00',
      })
      .returning();

    const [cust2] = await db
      .insert(customers)
      .values({
        companyId: company.id,
        name: 'Horizon Retail Partners',
        email: 'billing@horizonretail.com',
        phone: '+1 (555) 345-6789',
        address: '742 Evergreen Terrace, Portland, OR',
        taxNumber: 'US-CUST-8832',
        creditLimit: '15000.00',
        currentBalance: '0.00',
      })
      .returning();

    // E. Initial Suppliers
    const [supp1] = await db
      .insert(suppliers)
      .values({
        companyId: company.id,
        name: 'TechCore Hardware Distributors',
        email: 'orders@techcore.com',
        phone: '+1 (555) 765-4321',
        address: '200 Industrial Pkwy, Austin, TX',
        taxNumber: 'US-SUPP-1011',
        currentBalance: '10000.00',
      })
      .returning();

    const [supp2] = await db
      .insert(suppliers)
      .values({
        companyId: company.id,
        name: 'Pacific Office Properties LLC',
        email: 'landlord@pacificoffices.com',
        phone: '+1 (555) 987-6543',
        address: '450 Silicon Blvd, San Francisco, CA',
        taxNumber: 'US-SUPP-2022',
        currentBalance: '0.00',
      })
      .returning();

    // F. Initial Products
    const [prod1] = await db
      .insert(products)
      .values({
        companyId: company.id,
        code: 'PRD-SRV-01',
        name: 'Enterprise Server Node X1',
        category: 'Hardware',
        unit: 'unit',
        purchaseCost: '850.00',
        sellingPrice: '1600.00',
        assetAccountId: accountMap['1300'],
        cogsAccountId: accountMap['5010'],
        incomeAccountId: accountMap['4010'],
        reorderLevel: '5.00',
        quantityOnHand: '15.00',
        costingMethod: 'FIFO',
      })
      .returning();

    const [prod2] = await db
      .insert(products)
      .values({
        companyId: company.id,
        code: 'PRD-NET-02',
        name: 'Gigabit Switch Managed 48-Port',
        category: 'Networking',
        unit: 'unit',
        purchaseCost: '220.00',
        sellingPrice: '450.00',
        assetAccountId: accountMap['1300'],
        cogsAccountId: accountMap['5010'],
        incomeAccountId: accountMap['4010'],
        reorderLevel: '10.00',
        quantityOnHand: '25.00',
        costingMethod: 'FIFO',
      })
      .returning();

    // G. Initial Fixed Asset
    const [asset1] = await db
      .insert(fixedAssets)
      .values({
        companyId: company.id,
        assetCode: 'AST-EQ-001',
        name: 'Datacenter Server Racks & Workstations',
        acquisitionDate: '2026-01-15',
        acquisitionCost: '18000.00',
        usefulLifeYears: 5,
        residualValue: '1200.00',
        depreciationMethod: 'STRAIGHT_LINE',
        accumulatedDepreciation: '600.00',
        netBookValue: '17400.00',
        assetAccountId: accountMap['1500'],
        accumulatedDepAccountId: accountMap['1510'],
        depreciationExpenseAccountId: accountMap['5100'],
        location: 'Server Room B',
        department: 'Infrastructure',
        status: 'ACTIVE',
      })
      .returning();

    // H. Initial Employees for Payroll
    await db.insert(employees).values([
      {
        companyId: company.id,
        employeeNumber: 'EMP-001',
        firstName: 'Sarah',
        lastName: 'Jenkins',
        email: 'sarah.j@apextechnologies.io',
        department: 'Engineering',
        designation: 'Lead Systems Architect',
        basicSalary: '6500.00',
        paymentMethod: 'BANK_TRANSFER',
        bankDetails: 'Chase Bank - Acct *8921',
        isActive: true,
      },
      {
        companyId: company.id,
        employeeNumber: 'EMP-002',
        firstName: 'David',
        lastName: 'Chen',
        email: 'david.c@apextechnologies.io',
        department: 'Operations',
        designation: 'Operations Manager',
        basicSalary: '4800.00',
        paymentMethod: 'BANK_TRANSFER',
        bankDetails: 'Wells Fargo - Acct *3411',
        isActive: true,
      },
    ]);

    // I. Initial Balanced Journal Entries and Cash Book Records
    // 1. Initial Share Capital Contribution ($100,000)
    const [j1] = await db
      .insert(journalEntries)
      .values({
        companyId: company.id,
        journalNumber: 'JRN-2026-0001',
        date: '2026-01-05',
        accountingPeriod: '2026-01',
        referenceNumber: 'CAP-CONTRIB-01',
        sourceDocument: 'Shareholder Resolution',
        description: 'Initial equity contribution by shareholders',
        status: 'posted',
        createdBy: 'Eleanor Vance (CFO)',
        approvedBy: 'Marcus Brody (MD)',
      })
      .returning();

    await db.insert(journalLines).values([
      { journalEntryId: j1.id, accountId: accountMap['1030'], debit: '100000.00', credit: '0.00', description: 'Capital deposited into Operating Bank Account' },
      { journalEntryId: j1.id, accountId: accountMap['3010'], debit: '0.00', credit: '100000.00', description: 'Issued Share Capital' },
    ]);

    // 2. Acquisition of Fixed Assets ($18,000)
    const [j2] = await db
      .insert(journalEntries)
      .values({
        companyId: company.id,
        journalNumber: 'JRN-2026-0002',
        date: '2026-01-15',
        accountingPeriod: '2026-01',
        referenceNumber: 'PO-AST-01',
        sourceDocument: 'Purchase Invoice AST-001',
        description: 'Purchase of Datacenter Server Racks & Workstations',
        status: 'posted',
        createdBy: 'Eleanor Vance (CFO)',
        approvedBy: 'Marcus Brody (MD)',
      })
      .returning();

    await db.insert(journalLines).values([
      { journalEntryId: j2.id, accountId: accountMap['1500'], debit: '18000.00', credit: '0.00', description: 'Computer & Office Equipment acquired' },
      { journalEntryId: j2.id, accountId: accountMap['1030'], debit: '0.00', credit: '18000.00', description: 'Wire transfer payment to vendor' },
    ]);

    // 3. Office Rent Paid ($3,500)
    const [j3] = await db
      .insert(journalEntries)
      .values({
        companyId: company.id,
        journalNumber: 'JRN-2026-0003',
        date: '2026-02-01',
        accountingPeriod: '2026-02',
        referenceNumber: 'CHK-1002',
        sourceDocument: 'Lease Agreement',
        description: 'Payment of office rent for Silicon Blvd facility',
        status: 'posted',
        createdBy: 'Sarah Jenkins (Accountant)',
        approvedBy: 'Eleanor Vance (CFO)',
      })
      .returning();

    await db.insert(journalLines).values([
      { journalEntryId: j3.id, accountId: accountMap['5030'], debit: '3500.00', credit: '0.00', description: 'Office Rent & Facilities Expense' },
      { journalEntryId: j3.id, accountId: accountMap['1030'], debit: '0.00', credit: '3500.00', description: 'Disbursement from Operating Bank Account' },
    ]);

    // 4. Contra Entry: Bank Withdrawal for Office Cash ($5,000)
    const [j4] = await db
      .insert(journalEntries)
      .values({
        companyId: company.id,
        journalNumber: 'JRN-2026-0004',
        date: '2026-02-05',
        accountingPeriod: '2026-02',
        referenceNumber: 'CONTRA-WDL-01',
        sourceDocument: 'Bank Withdrawal Slip #891',
        description: 'Internal transfer: Cash withdrawn from Operating Bank for Office Cash',
        status: 'posted',
        createdBy: 'Eleanor Vance (CFO)',
        approvedBy: 'Marcus Brody (MD)',
      })
      .returning();

    await db.insert(journalLines).values([
      { journalEntryId: j4.id, accountId: accountMap['1010'], debit: '5000.00', credit: '0.00', description: 'Cash on Hand debit (contra transfer)' },
      { journalEntryId: j4.id, accountId: accountMap['1030'], debit: '0.00', credit: '5000.00', description: 'Operating Bank credit (contra transfer)' },
    ]);

    // Cash transaction record for Contra entry
    await db.insert(cashTransactions).values({
      companyId: company.id,
      journalEntryId: j4.id,
      transactionType: 'CONTRA_TRANSFER',
      bookType: 'DOUBLE_COLUMN',
      voucherNumber: 'CONTRA-001',
      date: '2026-02-05',
      accountId: accountMap['1030'],
      contraAccountId: accountMap['1010'],
      amount: '5000.00',
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'CONTRA-WDL-01',
      payerPayee: 'Apex Cash Float',
      description: 'Internal cash withdrawal for office operations float',
      status: 'posted',
      preparedBy: 'Eleanor Vance',
      approvedBy: 'Marcus Brody',
    });

    // 5. Credit Purchase of Inventory ($25,000) from TechCore Hardware
    const [j5] = await db
      .insert(journalEntries)
      .values({
        companyId: company.id,
        journalNumber: 'JRN-2026-0005',
        date: '2026-02-10',
        accountingPeriod: '2026-02',
        referenceNumber: 'BILL-TC-104',
        sourceDocument: 'Supplier Bill #104',
        description: 'Purchase of Server Nodes & Switches on credit',
        status: 'posted',
        createdBy: 'David Chen (Inventory)',
        approvedBy: 'Eleanor Vance (CFO)',
      })
      .returning();

    await db.insert(journalLines).values([
      { journalEntryId: j5.id, accountId: accountMap['1300'], debit: '25000.00', credit: '0.00', description: 'Merchandise Inventory received' },
      { journalEntryId: j5.id, accountId: accountMap['2010'], debit: '0.00', credit: '25000.00', description: 'Accounts Payable owed to TechCore' },
    ]);

    // 6. Partial Settlement of Supplier Bill ($15,000)
    const [j6] = await db
      .insert(journalEntries)
      .values({
        companyId: company.id,
        journalNumber: 'JRN-2026-0006',
        date: '2026-02-25',
        accountingPeriod: '2026-02',
        referenceNumber: 'PAY-TC-01',
        sourceDocument: 'Payment Voucher PV-001',
        description: 'Settlement towards TechCore Accounts Payable',
        status: 'posted',
        createdBy: 'Sarah Jenkins (Accountant)',
        approvedBy: 'Eleanor Vance (CFO)',
      })
      .returning();

    await db.insert(journalLines).values([
      { journalEntryId: j6.id, accountId: accountMap['2010'], debit: '15000.00', credit: '0.00', description: 'Accounts Payable reduction' },
      { journalEntryId: j6.id, accountId: accountMap['1030'], debit: '0.00', credit: '15000.00', description: 'Bank transfer payment' },
    ]);

    await db.insert(cashTransactions).values({
      companyId: company.id,
      journalEntryId: j6.id,
      transactionType: 'BANK_WITHDRAWAL',
      bookType: 'DOUBLE_COLUMN',
      voucherNumber: 'PV-2026-001',
      date: '2026-02-25',
      accountId: accountMap['1030'],
      amount: '15000.00',
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'WIRE-88902',
      payerPayee: 'TechCore Hardware Distributors',
      description: 'Vendor payment for inventory bill #104',
      status: 'posted',
      preparedBy: 'Sarah Jenkins',
      approvedBy: 'Eleanor Vance',
    });

    // 7. Credit Sale to Nexus Corp ($16,000 revenue + $2,400 VAT = $18,400) + COGS ($8,500)
    const [j7] = await db
      .insert(journalEntries)
      .values({
        companyId: company.id,
        journalNumber: 'JRN-2026-0007',
        date: '2026-03-02',
        accountingPeriod: '2026-03',
        referenceNumber: 'INV-2026-0001',
        sourceDocument: 'Sales Invoice INV-2026-0001',
        description: 'Credit sale of 10 Enterprise Server Nodes to Nexus Corp Solutions',
        status: 'posted',
        createdBy: 'Sarah Jenkins (Accountant)',
        approvedBy: 'Eleanor Vance (CFO)',
      })
      .returning();

    await db.insert(journalLines).values([
      { journalEntryId: j7.id, accountId: accountMap['1200'], debit: '18400.00', credit: '0.00', description: 'Accounts Receivable from Nexus Corp' },
      { journalEntryId: j7.id, accountId: accountMap['4010'], debit: '0.00', credit: '16000.00', description: 'Sales Revenue - Products' },
      { journalEntryId: j7.id, accountId: accountMap['2040'], debit: '0.00', credit: '2400.00', description: '15% Sales Tax / VAT Payable' },
      { journalEntryId: j7.id, accountId: accountMap['5010'], debit: '8500.00', credit: '0.00', description: 'Cost of Goods Sold perpetual recognition' },
      { journalEntryId: j7.id, accountId: accountMap['1300'], debit: '0.00', credit: '8500.00', description: 'Inventory reduction for 10 units' },
    ]);

    // Create Invoice record
    const [inv1] = await db
      .insert(invoices)
      .values({
        companyId: company.id,
        customerId: cust1.id,
        journalEntryId: j7.id,
        invoiceNumber: 'INV-2026-0001',
        date: '2026-03-02',
        dueDate: '2026-04-01',
        status: 'partially_paid',
        type: 'CREDIT_SALE',
        subtotal: '16000.00',
        taxAmount: '2400.00',
        totalAmount: '18400.00',
        amountPaid: '12000.00',
        paymentTerms: 'Net 30',
        notes: 'Delivery and installation included. Thank you.',
      })
      .returning();

    await db.insert(invoiceItems).values({
      invoiceId: inv1.id,
      productId: prod1.id,
      description: 'Enterprise Server Node X1 with redundant power supplies',
      quantity: '10.00',
      unitPrice: '1600.00',
      discount: '0.00',
      taxRate: '15.00',
      total: '18400.00',
    });

    // 8. Customer Payment Received from Nexus Corp ($12,000 into Operating Bank)
    const [j8] = await db
      .insert(journalEntries)
      .values({
        companyId: company.id,
        journalNumber: 'JRN-2026-0008',
        date: '2026-03-20',
        accountingPeriod: '2026-03',
        referenceNumber: 'REC-2026-0001',
        sourceDocument: 'Customer Receipt REC-001',
        description: 'Customer wire received against Invoice INV-2026-0001',
        status: 'posted',
        createdBy: 'Sarah Jenkins (Accountant)',
        approvedBy: 'Eleanor Vance (CFO)',
      })
      .returning();

    await db.insert(journalLines).values([
      { journalEntryId: j8.id, accountId: accountMap['1030'], debit: '12000.00', credit: '0.00', description: 'Operating Bank Account deposit' },
      { journalEntryId: j8.id, accountId: accountMap['1200'], debit: '0.00', credit: '12000.00', description: 'Accounts Receivable reduction' },
    ]);

    await db.insert(cashTransactions).values({
      companyId: company.id,
      journalEntryId: j8.id,
      transactionType: 'BANK_DEPOSIT',
      bookType: 'DOUBLE_COLUMN',
      voucherNumber: 'REC-2026-001',
      date: '2026-03-20',
      accountId: accountMap['1030'],
      amount: '12000.00',
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'WIRE-NEXUS-01',
      payerPayee: 'Nexus Corp Solutions',
      description: 'Partial settlement for Invoice INV-2026-0001',
      status: 'posted',
      preparedBy: 'Sarah Jenkins',
      approvedBy: 'Eleanor Vance',
    });

    // 9. Cash Sale recorded directly in Cash Book ($2,300 total = $2,000 revenue + $300 tax)
    const [j9] = await db
      .insert(journalEntries)
      .values({
        companyId: company.id,
        journalNumber: 'JRN-2026-0009',
        date: '2026-03-25',
        accountingPeriod: '2026-03',
        referenceNumber: 'CSH-REC-101',
        sourceDocument: 'Cash Register Tape #101',
        description: 'Direct cash sale of consulting and support services',
        status: 'posted',
        createdBy: 'Marcus Brody',
        approvedBy: 'Eleanor Vance',
      })
      .returning();

    await db.insert(journalLines).values([
      { journalEntryId: j9.id, accountId: accountMap['1010'], debit: '2300.00', credit: '0.00', description: 'Cash on Hand received' },
      { journalEntryId: j9.id, accountId: accountMap['4020'], debit: '0.00', credit: '2000.00', description: 'Professional Services Revenue' },
      { journalEntryId: j9.id, accountId: accountMap['2040'], debit: '0.00', credit: '300.00', description: 'Sales Tax / VAT collected' },
    ]);

    await db.insert(cashTransactions).values({
      companyId: company.id,
      journalEntryId: j9.id,
      transactionType: 'CASH_RECEIPT',
      bookType: 'DOUBLE_COLUMN',
      voucherNumber: 'CSH-REC-001',
      date: '2026-03-25',
      accountId: accountMap['1010'],
      amount: '2300.00',
      paymentMethod: 'CASH',
      referenceNumber: 'REG-101',
      payerPayee: 'Walk-in Client Services',
      description: 'On-site enterprise configuration consultation',
      status: 'posted',
      preparedBy: 'Marcus Brody',
      approvedBy: 'Eleanor Vance',
    });

    // 10. Contra Entry: Deposit Cash into Bank ($3,000)
    const [j10] = await db
      .insert(journalEntries)
      .values({
        companyId: company.id,
        journalNumber: 'JRN-2026-0010',
        date: '2026-03-28',
        accountingPeriod: '2026-03',
        referenceNumber: 'CONTRA-DEP-02',
        sourceDocument: 'Bank Deposit Slip #4412',
        description: 'Internal transfer: Surplus cash on hand deposited into Operating Bank Account',
        status: 'posted',
        createdBy: 'Eleanor Vance',
        approvedBy: 'Marcus Brody',
      })
      .returning();

    await db.insert(journalLines).values([
      { journalEntryId: j10.id, accountId: accountMap['1030'], debit: '3000.00', credit: '0.00', description: 'Operating Bank Account debited (contra transfer)' },
      { journalEntryId: j10.id, accountId: accountMap['1010'], debit: '0.00', credit: '3000.00', description: 'Cash on Hand credited (contra transfer)' },
    ]);

    await db.insert(cashTransactions).values({
      companyId: company.id,
      journalEntryId: j10.id,
      transactionType: 'CONTRA_TRANSFER',
      bookType: 'DOUBLE_COLUMN',
      voucherNumber: 'CONTRA-002',
      date: '2026-03-28',
      accountId: accountMap['1010'],
      contraAccountId: accountMap['1030'],
      amount: '3000.00',
      paymentMethod: 'CASH',
      referenceNumber: 'SLIP-4412',
      payerPayee: 'Bank Deposit',
      description: 'Excess cash on hand deposited into checking account',
      status: 'posted',
      preparedBy: 'Eleanor Vance',
      approvedBy: 'Marcus Brody',
    });

    // 11. Monthly Depreciation Journal ($300)
    const [j11] = await db
      .insert(journalEntries)
      .values({
        companyId: company.id,
        journalNumber: 'JRN-2026-0011',
        date: '2026-03-31',
        accountingPeriod: '2026-03',
        referenceNumber: 'DEP-2026-Q1',
        sourceDocument: 'Depreciation Schedule AST-EQ-001',
        description: 'Straight-line depreciation for computer equipment Q1',
        status: 'posted',
        createdBy: 'Sarah Jenkins (Accountant)',
        approvedBy: 'Eleanor Vance (CFO)',
      })
      .returning();

    await db.insert(journalLines).values([
      { journalEntryId: j11.id, accountId: accountMap['5100'], debit: '300.00', credit: '0.00', description: 'Depreciation Expense' },
      { journalEntryId: j11.id, accountId: accountMap['1510'], debit: '0.00', credit: '300.00', description: 'Accumulated Depreciation - Equipment' },
    ]);

    // 12. Utilities Expense Payment ($650)
    const [j12] = await db
      .insert(journalEntries)
      .values({
        companyId: company.id,
        journalNumber: 'JRN-2026-0012',
        date: '2026-03-31',
        accountingPeriod: '2026-03',
        referenceNumber: 'UTIL-ACH-99',
        sourceDocument: 'Utility Bill PG&E',
        description: 'Electric and internet facility expenses for March 2026',
        status: 'posted',
        createdBy: 'Sarah Jenkins (Accountant)',
        approvedBy: 'Eleanor Vance (CFO)',
      })
      .returning();

    await db.insert(journalLines).values([
      { journalEntryId: j12.id, accountId: accountMap['5040'], debit: '650.00', credit: '0.00', description: 'Utilities & Power Expense' },
      { journalEntryId: j12.id, accountId: accountMap['1030'], debit: '0.00', credit: '650.00', description: 'Disbursement from Operating Bank Account' },
    ]);

    // Initial Annual Budget
    await db.insert(budgets).values([
      { companyId: company.id, fiscalYear: '2026', accountId: accountMap['4010'], annualBudget: '250000.00' },
      { companyId: company.id, fiscalYear: '2026', accountId: accountMap['4020'], annualBudget: '50000.00' },
      { companyId: company.id, fiscalYear: '2026', accountId: accountMap['5010'], annualBudget: '120000.00' },
      { companyId: company.id, fiscalYear: '2026', accountId: accountMap['5020'], annualBudget: '70000.00' },
      { companyId: company.id, fiscalYear: '2026', accountId: accountMap['5030'], annualBudget: '42000.00' },
      { companyId: company.id, fiscalYear: '2026', accountId: accountMap['5040'], annualBudget: '8000.00' },
    ]);

    await logAudit(
      company.id,
      'system',
      'system@smartbooks.local',
      'CREATE',
      'COMPANY',
      String(company.id),
      'Initialized company profile, standard chart of accounts, and opening double-entry ledger'
    );

    console.log('SmartBooks database successfully seeded with double-entry integrity!');
    return company;
  } catch (error) {
    console.error('Error during initial data seeding:', error);
    throw error;
  }
}
