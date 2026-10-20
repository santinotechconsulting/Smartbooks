export interface Company {
  id: number;
  name: string;
  tradingName: string | null;
  registrationNumber: string | null;
  taxId: string | null;
  address: string | null;
  city: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  currency: string;
  currencySymbol: string;
  financialYearStart: string;
  financialYearEnd: string;
  accountingMethod: string;
  invoiceFormat: string;
  receiptFormat: string;
  journalFormat: string;
  documentFooter: string;
  authorisedSignatories: string;
  isLocked: boolean;
  lockDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: number;
  companyId: number;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  category: string;
  parentAccountId: number | null;
  isContra: boolean;
  isActive: boolean;
  description: string | null;
  openingDebit: string;
  openingCredit: string;
  periodDebit?: number;
  periodCredit?: number;
  balance?: number;
  createdAt: string;
}

export interface JournalLine {
  id?: number;
  journalEntryId?: number;
  accountId: number;
  account?: Account;
  debit: string;
  credit: string;
  description?: string;
  currency?: string;
  exchangeRate?: string;
}

export interface JournalEntry {
  id: number;
  companyId: number;
  journalNumber: string;
  date: string;
  accountingPeriod: string;
  referenceNumber: string | null;
  sourceDocument: string;
  description: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'posted' | 'reversed' | 'rejected';
  createdBy: string;
  approvedBy: string | null;
  isReversed: boolean;
  reversalOfId: number | null;
  createdAt: string;
  lines: JournalLine[];
}

export interface CashTransaction {
  id: number;
  companyId: number;
  journalEntryId: number | null;
  transactionType: 'CASH_RECEIPT' | 'CASH_PAYMENT' | 'BANK_DEPOSIT' | 'BANK_WITHDRAWAL' | 'CONTRA_TRANSFER' | 'PETTY_CASH';
  bookType: 'SINGLE_COLUMN' | 'DOUBLE_COLUMN' | 'THREE_COLUMN' | 'PETTY_CASH';
  voucherNumber: string;
  date: string;
  accountId: number;
  contraAccountId: number | null;
  amount: string;
  discountAmount: string;
  paymentMethod: string;
  referenceNumber: string | null;
  payerPayee: string;
  description: string;
  status: string;
  preparedBy?: string;
  approvedBy?: string;
  cashReceipt?: number;
  cashPayment?: number;
  bankReceipt?: number;
  bankPayment?: number;
  discount?: number;
  runningCash?: number;
  runningBank?: number;
}

export interface Customer {
  id: number;
  companyId: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxNumber: string | null;
  creditLimit: string;
  openingBalance: string;
  currentBalance: string;
}

export interface InvoiceItem {
  id?: number;
  invoiceId?: number;
  productId: number | null;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  taxRate: string;
  total: string;
}

export interface Invoice {
  id: number;
  companyId: number;
  customerId: number;
  customer?: Customer;
  journalEntryId: number | null;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  status: 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'voided';
  type: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  amountPaid: string;
  paymentTerms: string;
  notes: string | null;
  items?: InvoiceItem[];
}

export interface Supplier {
  id: number;
  companyId: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxNumber: string | null;
  openingBalance: string;
  currentBalance: string;
}

export interface BillItem {
  id?: number;
  billId?: number;
  productId: number | null;
  expenseAccountId: number | null;
  description: string;
  quantity: string;
  unitCost: string;
  taxRate: string;
  total: string;
}

export interface Bill {
  id: number;
  companyId: number;
  supplierId: number;
  supplier?: Supplier;
  journalEntryId: number | null;
  billNumber: string;
  date: string;
  dueDate: string;
  status: 'draft' | 'received' | 'partially_paid' | 'paid' | 'overdue' | 'voided';
  type: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  amountPaid: string;
  notes: string | null;
  items?: BillItem[];
}

export interface Product {
  id: number;
  companyId: number;
  code: string;
  name: string;
  category: string;
  unit: string;
  purchaseCost: string;
  sellingPrice: string;
  assetAccountId: number | null;
  cogsAccountId: number | null;
  incomeAccountId: number | null;
  reorderLevel: string;
  quantityOnHand: string;
  costingMethod: string;
}

export interface FixedAsset {
  id: number;
  companyId: number;
  assetCode: string;
  name: string;
  acquisitionDate: string;
  acquisitionCost: string;
  usefulLifeYears: number;
  residualValue: string;
  depreciationMethod: string;
  accumulatedDepreciation: string;
  netBookValue: string;
  assetAccountId: number | null;
  accumulatedDepAccountId: number | null;
  depreciationExpenseAccountId: number | null;
  location: string | null;
  department: string | null;
  status: string;
}

export interface BankReconciliation {
  id: number;
  companyId: number;
  accountId: number;
  statementDate: string;
  statementEndingBalance: string;
  bookBalance: string;
  depositsInTransit: string;
  outstandingCheques: string;
  bankCharges: string;
  bankInterest: string;
  adjustedBankBalance: string;
  adjustedBookBalance: string;
  difference: string;
  status: string;
  completedAt: string | null;
}

export interface AuditLog {
  id: number;
  companyId: number | null;
  userId: string | null;
  userEmail: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  createdAt: string;
}
