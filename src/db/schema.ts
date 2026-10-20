import { boolean, integer, numeric, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Companies & Organizations
export const companies = pgTable('companies', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  tradingName: text('trading_name'),
  registrationNumber: text('registration_number'),
  taxId: text('tax_id'),
  address: text('address'),
  city: text('city'),
  country: text('country').default('United States'),
  phone: text('phone'),
  email: text('email'),
  website: text('website'),
  logoUrl: text('logo_url'),
  currency: text('currency').default('USD').notNull(),
  currencySymbol: text('currency_symbol').default('$').notNull(),
  financialYearStart: text('financial_year_start').default('01-01').notNull(),
  financialYearEnd: text('financial_year_end').default('12-31').notNull(),
  accountingMethod: text('accounting_method').default('ACCRUAL').notNull(), // ACCRUAL | CASH
  invoiceFormat: text('invoice_format').default('INV-{YYYY}-{0000}').notNull(),
  receiptFormat: text('receipt_format').default('REC-{YYYY}-{0000}').notNull(),
  journalFormat: text('journal_format').default('JRN-{YYYY}-{0000}').notNull(),
  documentFooter: text('document_footer').default('Thank you for your business. Certified double-entry records.'),
  authorisedSignatories: text('authorised_signatories').default('Financial Controller, Managing Director'),
  isLocked: boolean('is_locked').default(false).notNull(),
  lockDate: text('lock_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. Users & Role-Based Access Control
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: text('role').default('super_admin').notNull(), // super_admin, company_admin, accountant, bookkeeper, cashier, auditor, finance_manager, inventory_manager, sales_officer, viewer
  companyId: integer('company_id').references(() => companies.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Chart of Accounts
export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').references(() => companies.id).notNull(),
  code: text('code').notNull(), // e.g. 1010, 2010, 4010
  name: text('name').notNull(),
  type: text('type').notNull(), // ASSET | LIABILITY | EQUITY | INCOME | EXPENSE
  category: text('category').notNull(), // Cash & Bank, Current Assets, Accounts Receivable, Inventory, Fixed Assets, Current Liabilities, Accounts Payable, Long Term Liabilities, Equity, Sales Revenue, Cost of Goods Sold, Operating Expenses, Finance Costs, Tax
  parentAccountId: integer('parent_account_id'),
  isContra: boolean('is_contra').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  description: text('description'),
  openingDebit: numeric('opening_debit', { precision: 18, scale: 2 }).default('0.00').notNull(),
  openingCredit: numeric('opening_credit', { precision: 18, scale: 2 }).default('0.00').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. Double-Entry General Journal Entries
export const journalEntries = pgTable('journal_entries', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').references(() => companies.id).notNull(),
  journalNumber: text('journal_number').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  accountingPeriod: text('accounting_period').notNull(), // e.g. 2026-10
  referenceNumber: text('reference_number'),
  sourceDocument: text('source_document').default('General Journal'), // General Journal, Sales Invoice, Purchase Bill, Cash Receipt, Cash Payment, Payroll, Depreciation
  description: text('description').notNull(),
  status: text('status').default('posted').notNull(), // draft | pending_approval | approved | posted | reversed | rejected
  createdBy: text('created_by').notNull(),
  approvedBy: text('approved_by'),
  isReversed: boolean('is_reversed').default(false).notNull(),
  reversalOfId: integer('reversal_of_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 5. Journal Lines (Enforcing Total Debits = Total Credits)
export const journalLines = pgTable('journal_lines', {
  id: serial('id').primaryKey(),
  journalEntryId: integer('journal_entry_id').references(() => journalEntries.id, { onDelete: 'cascade' }).notNull(),
  accountId: integer('account_id').references(() => accounts.id).notNull(),
  debit: numeric('debit', { precision: 18, scale: 2 }).default('0.00').notNull(),
  credit: numeric('credit', { precision: 18, scale: 2 }).default('0.00').notNull(),
  description: text('description'),
  currency: text('currency').default('USD').notNull(),
  exchangeRate: numeric('exchange_rate', { precision: 10, scale: 4 }).default('1.0000').notNull(),
});

// 6. Cash Book & Transactions (Single, Double, Three-Column & Petty Cash)
export const cashTransactions = pgTable('cash_transactions', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').references(() => companies.id).notNull(),
  journalEntryId: integer('journal_entry_id').references(() => journalEntries.id),
  transactionType: text('transaction_type').notNull(), // CASH_RECEIPT, CASH_PAYMENT, BANK_DEPOSIT, BANK_WITHDRAWAL, CONTRA_TRANSFER, PETTY_CASH
  bookType: text('book_type').default('DOUBLE_COLUMN').notNull(), // SINGLE_COLUMN, DOUBLE_COLUMN, THREE_COLUMN, PETTY_CASH
  voucherNumber: text('voucher_number').notNull(),
  date: text('date').notNull(),
  accountId: integer('account_id').references(() => accounts.id).notNull(), // Cash or Bank Account
  contraAccountId: integer('contra_account_id').references(() => accounts.id), // For transfers/contra
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  discountAmount: numeric('discount_amount', { precision: 18, scale: 2 }).default('0.00').notNull(),
  paymentMethod: text('payment_method').default('CASH').notNull(), // CASH, BANK_TRANSFER, CHEQUE, CARD, MOBILE_MONEY
  referenceNumber: text('reference_number'),
  payerPayee: text('payer_payee').notNull(),
  description: text('description').notNull(),
  status: text('status').default('posted').notNull(),
  preparedBy: text('prepared_by'),
  approvedBy: text('approved_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 7. Customers & Accounts Receivable
export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').references(() => companies.id).notNull(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  taxNumber: text('tax_number'),
  creditLimit: numeric('credit_limit', { precision: 18, scale: 2 }).default('0.00'),
  openingBalance: numeric('opening_balance', { precision: 18, scale: 2 }).default('0.00').notNull(),
  currentBalance: numeric('current_balance', { precision: 18, scale: 2 }).default('0.00').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 8. Sales Invoices
export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').references(() => companies.id).notNull(),
  customerId: integer('customer_id').references(() => customers.id).notNull(),
  journalEntryId: integer('journal_entry_id').references(() => journalEntries.id),
  invoiceNumber: text('invoice_number').notNull(),
  date: text('date').notNull(),
  dueDate: text('due_date').notNull(),
  status: text('status').default('draft').notNull(), // draft, sent, partially_paid, paid, overdue, voided
  type: text('type').default('CREDIT_SALE').notNull(), // CREDIT_SALE, CASH_SALE, RETURN
  subtotal: numeric('subtotal', { precision: 18, scale: 2 }).default('0.00').notNull(),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).default('0.00').notNull(),
  discountAmount: numeric('discount_amount', { precision: 18, scale: 2 }).default('0.00').notNull(),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).default('0.00').notNull(),
  amountPaid: numeric('amount_paid', { precision: 18, scale: 2 }).default('0.00').notNull(),
  paymentTerms: text('payment_terms').default('Net 30'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const invoiceItems = pgTable('invoice_items', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
  productId: integer('product_id'),
  description: text('description').notNull(),
  quantity: numeric('quantity', { precision: 12, scale: 2 }).default('1.00').notNull(),
  unitPrice: numeric('unit_price', { precision: 18, scale: 2 }).default('0.00').notNull(),
  discount: numeric('discount', { precision: 18, scale: 2 }).default('0.00').notNull(),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).default('0.00').notNull(),
  total: numeric('total', { precision: 18, scale: 2 }).default('0.00').notNull(),
});

// 9. Suppliers & Accounts Payable
export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').references(() => companies.id).notNull(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  taxNumber: text('tax_number'),
  openingBalance: numeric('opening_balance', { precision: 18, scale: 2 }).default('0.00').notNull(),
  currentBalance: numeric('current_balance', { precision: 18, scale: 2 }).default('0.00').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 10. Purchase Bills
export const bills = pgTable('bills', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').references(() => companies.id).notNull(),
  supplierId: integer('supplier_id').references(() => suppliers.id).notNull(),
  journalEntryId: integer('journal_entry_id').references(() => journalEntries.id),
  billNumber: text('bill_number').notNull(),
  date: text('date').notNull(),
  dueDate: text('due_date').notNull(),
  status: text('status').default('draft').notNull(), // draft, received, partially_paid, paid, overdue, voided
  type: text('type').default('CREDIT_PURCHASE').notNull(), // CREDIT_PURCHASE, CASH_PURCHASE, RETURN
  subtotal: numeric('subtotal', { precision: 18, scale: 2 }).default('0.00').notNull(),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 2 }).default('0.00').notNull(),
  totalAmount: numeric('total_amount', { precision: 18, scale: 2 }).default('0.00').notNull(),
  amountPaid: numeric('amount_paid', { precision: 18, scale: 2 }).default('0.00').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const billItems = pgTable('bill_items', {
  id: serial('id').primaryKey(),
  billId: integer('bill_id').references(() => bills.id, { onDelete: 'cascade' }).notNull(),
  productId: integer('product_id'),
  expenseAccountId: integer('expense_account_id').references(() => accounts.id),
  description: text('description').notNull(),
  quantity: numeric('quantity', { precision: 12, scale: 2 }).default('1.00').notNull(),
  unitCost: numeric('unit_cost', { precision: 18, scale: 2 }).default('0.00').notNull(),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).default('0.00').notNull(),
  total: numeric('total', { precision: 18, scale: 2 }).default('0.00').notNull(),
});

// 11. Inventory & Stock Valuation
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').references(() => companies.id).notNull(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  category: text('category').default('General').notNull(),
  unit: text('unit').default('pcs').notNull(),
  purchaseCost: numeric('purchase_cost', { precision: 18, scale: 2 }).default('0.00').notNull(),
  sellingPrice: numeric('selling_price', { precision: 18, scale: 2 }).default('0.00').notNull(),
  assetAccountId: integer('asset_account_id').references(() => accounts.id),
  cogsAccountId: integer('cogs_account_id').references(() => accounts.id),
  incomeAccountId: integer('income_account_id').references(() => accounts.id),
  reorderLevel: numeric('reorder_level', { precision: 12, scale: 2 }).default('5.00').notNull(),
  quantityOnHand: numeric('quantity_on_hand', { precision: 12, scale: 2 }).default('0.00').notNull(),
  costingMethod: text('costing_method').default('FIFO').notNull(), // FIFO, WEIGHTED_AVERAGE
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const inventoryMovements = pgTable('inventory_movements', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').references(() => companies.id).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  date: text('date').notNull(),
  movementType: text('movement_type').notNull(), // OPENING, PURCHASE, SALE, PURCHASE_RETURN, SALES_RETURN, ADJUSTMENT_ADD, ADJUSTMENT_DAMAGE
  quantity: numeric('quantity', { precision: 12, scale: 2 }).notNull(), // positive for in, negative for out
  unitCost: numeric('unit_cost', { precision: 18, scale: 2 }).notNull(),
  totalCost: numeric('total_cost', { precision: 18, scale: 2 }).notNull(),
  reference: text('reference'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 12. Fixed Assets & Depreciation
export const fixedAssets = pgTable('fixed_assets', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').references(() => companies.id).notNull(),
  assetCode: text('asset_code').notNull(),
  name: text('name').notNull(),
  acquisitionDate: text('acquisition_date').notNull(),
  acquisitionCost: numeric('acquisition_cost', { precision: 18, scale: 2 }).notNull(),
  usefulLifeYears: integer('useful_life_years').default(5).notNull(),
  residualValue: numeric('residual_value', { precision: 18, scale: 2 }).default('0.00').notNull(),
  depreciationMethod: text('depreciation_method').default('STRAIGHT_LINE').notNull(), // STRAIGHT_LINE, REDUCING_BALANCE
  accumulatedDepreciation: numeric('accumulated_depreciation', { precision: 18, scale: 2 }).default('0.00').notNull(),
  netBookValue: numeric('net_book_value', { precision: 18, scale: 2 }).notNull(),
  assetAccountId: integer('asset_account_id').references(() => accounts.id),
  accumulatedDepAccountId: integer('accumulated_dep_account_id').references(() => accounts.id),
  depreciationExpenseAccountId: integer('depreciation_expense_account_id').references(() => accounts.id),
  location: text('location'),
  department: text('department'),
  status: text('status').default('ACTIVE').notNull(), // ACTIVE, DISPOSED
  disposalDate: text('disposal_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const depreciationLogs = pgTable('depreciation_logs', {
  id: serial('id').primaryKey(),
  assetId: integer('asset_id').references(() => fixedAssets.id).notNull(),
  period: text('period').notNull(),
  date: text('date').notNull(),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  journalEntryId: integer('journal_entry_id').references(() => journalEntries.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 13. Configurable Tax Rates
export const taxRates = pgTable('tax_rates', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').references(() => companies.id).notNull(),
  name: text('name').notNull(),
  code: text('code').notNull(),
  rate: numeric('rate', { precision: 5, scale: 2 }).notNull(),
  type: text('type').default('VAT').notNull(), // VAT, SALES_TAX, WITHHOLDING, ZERO_RATED, EXEMPT
  isActive: boolean('is_active').default(true).notNull(),
});

// 14. Bank Reconciliation
export const bankReconciliations = pgTable('bank_reconciliations', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').references(() => companies.id).notNull(),
  accountId: integer('account_id').references(() => accounts.id).notNull(), // Bank account being reconciled
  statementDate: text('statement_date').notNull(),
  statementEndingBalance: numeric('statement_ending_balance', { precision: 18, scale: 2 }).notNull(),
  bookBalance: numeric('book_balance', { precision: 18, scale: 2 }).notNull(),
  depositsInTransit: numeric('deposits_in_transit', { precision: 18, scale: 2 }).default('0.00').notNull(),
  outstandingCheques: numeric('outstanding_cheques', { precision: 18, scale: 2 }).default('0.00').notNull(),
  bankCharges: numeric('bank_charges', { precision: 18, scale: 2 }).default('0.00').notNull(),
  bankInterest: numeric('bank_interest', { precision: 18, scale: 2 }).default('0.00').notNull(),
  adjustedBankBalance: numeric('adjusted_bank_balance', { precision: 18, scale: 2 }).notNull(),
  adjustedBookBalance: numeric('adjusted_book_balance', { precision: 18, scale: 2 }).notNull(),
  difference: numeric('difference', { precision: 18, scale: 2 }).default('0.00').notNull(),
  status: text('status').default('in_progress').notNull(), // in_progress, completed
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 15. Payroll Accounting
export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').references(() => companies.id).notNull(),
  employeeNumber: text('employee_number').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  department: text('department').default('Operations').notNull(),
  designation: text('designation').notNull(),
  basicSalary: numeric('basic_salary', { precision: 18, scale: 2 }).notNull(),
  paymentMethod: text('payment_method').default('BANK_TRANSFER').notNull(),
  bankDetails: text('bank_details'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const payrolls = pgTable('payrolls', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').references(() => companies.id).notNull(),
  period: text('period').notNull(), // e.g. 2026-10
  payDate: text('pay_date').notNull(),
  totalBasic: numeric('total_basic', { precision: 18, scale: 2 }).notNull(),
  totalAllowances: numeric('total_allowances', { precision: 18, scale: 2 }).default('0.00').notNull(),
  totalDeductions: numeric('total_deductions', { precision: 18, scale: 2 }).default('0.00').notNull(),
  totalEmployerContributions: numeric('total_employer_contributions', { precision: 18, scale: 2 }).default('0.00').notNull(),
  netPay: numeric('net_pay', { precision: 18, scale: 2 }).notNull(),
  status: text('status').default('draft').notNull(), // draft, approved, posted
  journalEntryId: integer('journal_entry_id').references(() => journalEntries.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const payrollItems = pgTable('payroll_items', {
  id: serial('id').primaryKey(),
  payrollId: integer('payroll_id').references(() => payrolls.id, { onDelete: 'cascade' }).notNull(),
  employeeId: integer('employee_id').references(() => employees.id).notNull(),
  basicSalary: numeric('basic_salary', { precision: 18, scale: 2 }).notNull(),
  allowances: numeric('allowances', { precision: 18, scale: 2 }).default('0.00').notNull(),
  overtime: numeric('overtime', { precision: 18, scale: 2 }).default('0.00').notNull(),
  bonuses: numeric('bonuses', { precision: 18, scale: 2 }).default('0.00').notNull(),
  taxDeduction: numeric('tax_deduction', { precision: 18, scale: 2 }).default('0.00').notNull(),
  socialSecurity: numeric('social_security', { precision: 18, scale: 2 }).default('0.00').notNull(),
  otherDeductions: numeric('other_deductions', { precision: 18, scale: 2 }).default('0.00').notNull(),
  netSalary: numeric('net_salary', { precision: 18, scale: 2 }).notNull(),
});

// 16. Budgets
export const budgets = pgTable('budgets', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').references(() => companies.id).notNull(),
  fiscalYear: text('fiscal_year').notNull(), // e.g. 2026
  accountId: integer('account_id').references(() => accounts.id).notNull(),
  annualBudget: numeric('annual_budget', { precision: 18, scale: 2 }).notNull(),
  monthlyBudgets: text('monthly_budgets'), // JSON array of 12 amounts
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 17. Comprehensive Audit Log
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').references(() => companies.id),
  userId: text('user_id'),
  userEmail: text('user_email'),
  action: text('action').notNull(), // CREATE, UPDATE, APPROVE, POST, REVERSE, DELETE_ATTEMPT
  entityType: text('entity_type').notNull(), // JOURNAL, INVOICE, BILL, CASH_BOOK, ASSET, RECONCILIATION, ACCOUNT, COMPANY, PAYROLL
  entityId: text('entity_id').notNull(),
  details: text('details').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relationships
export const accountsRelations = relations(accounts, ({ one, many }) => ({
  company: one(companies, { fields: [accounts.companyId], references: [companies.id] }),
  parentAccount: one(accounts, { fields: [accounts.parentAccountId], references: [accounts.id] }),
  journalLines: many(journalLines),
}));

export const journalEntriesRelations = relations(journalEntries, ({ one, many }) => ({
  company: one(companies, { fields: [journalEntries.companyId], references: [companies.id] }),
  lines: many(journalLines),
  reversalOf: one(journalEntries, { fields: [journalEntries.reversalOfId], references: [journalEntries.id] }),
}));

export const journalLinesRelations = relations(journalLines, ({ one }) => ({
  entry: one(journalEntries, { fields: [journalLines.journalEntryId], references: [journalEntries.id] }),
  account: one(accounts, { fields: [journalLines.accountId], references: [accounts.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  customer: one(customers, { fields: [invoices.customerId], references: [customers.id] }),
  items: many(invoiceItems),
  journalEntry: one(journalEntries, { fields: [invoices.journalEntryId], references: [journalEntries.id] }),
}));

export const billsRelations = relations(bills, ({ one, many }) => ({
  supplier: one(suppliers, { fields: [bills.supplierId], references: [suppliers.id] }),
  items: many(billItems),
  journalEntry: one(journalEntries, { fields: [bills.journalEntryId], references: [journalEntries.id] }),
}));
