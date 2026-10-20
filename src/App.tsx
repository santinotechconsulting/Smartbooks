import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar.tsx';
import { Header } from './components/Header.tsx';
import { MobileBottomNav } from './components/MobileBottomNav.tsx';
import { PrintDocumentModal, DocumentData } from './components/PrintDocumentModal.tsx';
import { ToastContainer, ToastMessage } from './components/Toast.tsx';
import { DashboardView } from './views/DashboardView.tsx';
import { CashBookView } from './views/CashBookView.tsx';
import { GeneralJournalView } from './views/GeneralJournalView.tsx';
import { GeneralLedgerView } from './views/GeneralLedgerView.tsx';
import { ChartOfAccountsView } from './views/ChartOfAccountsView.tsx';
import { InvoicingView } from './views/InvoicingView.tsx';
import { PurchasesView } from './views/PurchasesView.tsx';
import { InventoryView } from './views/InventoryView.tsx';
import { FinancialStatementsView } from './views/FinancialStatementsView.tsx';
import { BankReconciliationView } from './views/BankReconciliationView.tsx';
import { FixedAssetsView } from './views/FixedAssetsView.tsx';
import { AuditAndSettingsView } from './views/AuditAndSettingsView.tsx';

import {
  Company,
  Account,
  JournalEntry,
  CashTransaction,
  Invoice,
  Customer,
  Bill,
  Supplier,
  Product,
  FixedAsset,
  BankReconciliation,
  AuditLog,
} from './types.ts';

export default function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [availableCompanies, setAvailableCompanies] = useState<Company[]>([]);
  const [userRole, setUserRole] = useState('super_admin');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Core Data
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [cashBookData, setCashBookData] = useState<any>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);
  const [reconciliations, setReconciliations] = useState<BankReconciliation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Financial Reports Cache
  const [trialBalanceData, setTrialBalanceData] = useState<any>(null);
  const [incomeStatementData, setIncomeStatementData] = useState<any>(null);
  const [balanceSheetData, setBalanceSheetData] = useState<any>(null);
  const [cashFlowData, setCashFlowData] = useState<any>(null);

  // Toast Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Printable Document Modal State
  const [printDoc, setPrintDoc] = useState<DocumentData | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // New Company Registration Modal
  const [showNewCompanyModal, setShowNewCompanyModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyCurrency, setNewCompanyCurrency] = useState('USD');
  const [newCompanySymbol, setNewCompanySymbol] = useState('$');

  // Load Session and All Accounting Data
  const loadInitialData = async () => {
    setIsRefreshing(true);
    try {
      // 1. Session & Active Company
      const meRes = await fetch('/api/auth/me', {
        headers: { 'x-user-role': userRole },
      });
      if (meRes.ok) {
        const meData = await meRes.json();
        setActiveCompany(meData.activeCompany);
        setAvailableCompanies(meData.availableCompanies || []);
        if (meData.user?.role) setUserRole(meData.user.role);
      }

      // 2. Fetch Accounts
      const accRes = await fetch('/api/accounts');
      if (accRes.ok) {
        const accs = await accRes.json();
        setAccounts(accs);
      }

      // 3. Fetch Journals
      const jRes = await fetch('/api/journals');
      if (jRes.ok) {
        const js = await jRes.json();
        setJournals(js);
      }

      // 4. Fetch Cash Book
      const cbRes = await fetch('/api/cash-book');
      if (cbRes.ok) {
        const cb = await cbRes.json();
        setCashBookData(cb);
      }

      // 5. Invoices & Customers
      const invRes = await fetch('/api/sales/invoices');
      if (invRes.ok) setInvoices(await invRes.json());
      const custRes = await fetch('/api/sales/customers');
      if (custRes.ok) setCustomers(await custRes.json());

      // 6. Bills & Suppliers
      const billRes = await fetch('/api/purchases/bills');
      if (billRes.ok) setBills(await billRes.json());
      const suppRes = await fetch('/api/purchases/suppliers');
      if (suppRes.ok) setSuppliers(await suppRes.json());

      // 7. Inventory Products
      const prodRes = await fetch('/api/inventory/products');
      if (prodRes.ok) setProducts(await prodRes.json());

      // 8. Fixed Assets
      const astRes = await fetch('/api/fixed-assets');
      if (astRes.ok) setFixedAssets(await astRes.json());

      // 9. Bank Reconciliations
      const recRes = await fetch('/api/bank-reconciliations');
      if (recRes.ok) setReconciliations(await recRes.json());

      // 10. Audit Logs
      const logRes = await fetch('/api/audit-logs');
      if (logRes.ok) setAuditLogs(await logRes.json());

      // 11. Reports
      const [tbRes, isRes, bsRes, cfRes] = await Promise.all([
        fetch('/api/reports/trial-balance'),
        fetch('/api/reports/income-statement'),
        fetch('/api/reports/balance-sheet'),
        fetch('/api/reports/cash-flow'),
      ]);

      if (tbRes.ok) setTrialBalanceData(await tbRes.json());
      if (isRes.ok) setIncomeStatementData(await isRes.json());
      if (bsRes.ok) setBalanceSheetData(await bsRes.json());
      if (cfRes.ok) setCashFlowData(await cfRes.json());
    } catch (err) {
      console.error('Error fetching SmartBooks accounting data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleSwitchCompany = async (companyId: number) => {
    try {
      const res = await fetch('/api/companies/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      if (res.ok) {
        await loadInitialData();
      }
    } catch (err) {
      console.error('Failed to switch entity:', err);
    }
  };

  const handleCreateCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName) return;
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCompanyName,
          currency: newCompanyCurrency,
          currencySymbol: newCompanySymbol,
        }),
      });
      if (res.ok) {
        showToast(`Organization "${newCompanyName}" registered successfully!`, 'success');
        setShowNewCompanyModal(false);
        setNewCompanyName('');
        await loadInitialData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to register company', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to register company', 'error');
    }
  };

  // Direct Operations
  const handlePostJournal = async (journalData: any) => {
    const res = await fetch('/api/journals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': userRole },
      body: JSON.stringify(journalData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to post journal entry');
    }
  };

  const handleReverseJournal = async (journalId: number) => {
    const res = await fetch(`/api/journals/${journalId}/reverse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': userRole },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to reverse journal entry');
    }
  };

  const handleRecordCashTransaction = async (data: any) => {
    const res = await fetch('/api/cash-book/entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': userRole },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to record transaction');
    }
  };

  const handleCreateInvoice = async (data: any) => {
    const res = await fetch('/api/sales/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': userRole },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create invoice');
    }
  };

  const handleRecordCustomerPayment = async (invoiceId: number, data: any) => {
    const res = await fetch(`/api/sales/invoices/${invoiceId}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': userRole },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to record customer payment');
    }
  };

  const handleCreateCustomer = async (data: any) => {
    const res = await fetch('/api/sales/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to register customer');
    }
  };

  const handleCreateBill = async (data: any) => {
    const res = await fetch('/api/purchases/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to record bill');
    }
  };

  const handleCreateSupplier = async (data: any) => {
    const res = await fetch('/api/purchases/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to register supplier');
    }
  };

  const handleCreateProduct = async (data: any) => {
    const res = await fetch('/api/inventory/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create product');
    }
  };

  const handleCreateAccount = async (data: any) => {
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create account');
    }
  };

  const handlePostDepreciation = async (assetId: number, period: string, amount: string) => {
    const res = await fetch('/api/fixed-assets/depreciate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId, period, amount }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to post depreciation');
    }
  };

  const handleSaveReconciliation = async (data: any) => {
    const res = await fetch('/api/bank-reconciliations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save reconciliation');
    }
  };

  const handleUpdateCompany = async (data: any) => {
    if (!activeCompany) return;
    const res = await fetch(`/api/companies/${activeCompany.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update company');
    }
  };

  const openPrintModal = (doc: DocumentData) => {
    setPrintDoc(doc);
    setShowPrintModal(true);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800">
      {/* Sidebar (Desktop persistent + Mobile overlay drawer) */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        activeCompany={activeCompany}
        availableCompanies={availableCompanies}
        onSwitchCompany={handleSwitchCompany}
        onOpenNewCompanyModal={() => setShowNewCompanyModal(true)}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        <Header
          activeView={activeView}
          activeCompany={activeCompany}
          userRole={userRole}
          setUserRole={setUserRole}
          onOpenQuickJournal={() => setActiveView('journal')}
          onOpenQuickCash={() => setActiveView('cash-book')}
          onRefreshData={loadInitialData}
          isRefreshing={isRefreshing}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        {/* Content canvas with mobile bottom nav safe-area padding */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 pb-20 lg:pb-6">
          {activeView === 'dashboard' && (
            <DashboardView
              company={activeCompany}
              accounts={accounts}
              journals={journals}
              trialBalanceData={trialBalanceData}
              balanceSheetData={balanceSheetData}
              incomeStatementData={incomeStatementData}
              onNavigate={setActiveView}
              onOpenQuickJournal={() => setActiveView('journal')}
              onOpenQuickCash={() => setActiveView('cash-book')}
              onOpenQuickInvoice={() => setActiveView('invoicing')}
              onViewJournal={(j) => setActiveView('journal')}
            />
          )}

          {activeView === 'cash-book' && (
            <CashBookView
              company={activeCompany}
              accounts={accounts}
              cashBookData={cashBookData}
              onRefresh={loadInitialData}
              onOpenPrintModal={openPrintModal}
              onRecordTransaction={handleRecordCashTransaction}
              showToast={showToast}
            />
          )}

          {activeView === 'journal' && (
            <GeneralJournalView
              company={activeCompany}
              accounts={accounts}
              journals={journals}
              onRefresh={loadInitialData}
              onOpenPrintModal={openPrintModal}
              onPostJournal={handlePostJournal}
              onReverseJournal={handleReverseJournal}
              showToast={showToast}
            />
          )}

          {activeView === 'ledger' && (
            <GeneralLedgerView
              company={activeCompany}
              accounts={accounts}
              onOpenPrintModal={openPrintModal}
            />
          )}

          {activeView === 'accounts' && (
            <ChartOfAccountsView
              company={activeCompany}
              accounts={accounts}
              onRefresh={loadInitialData}
              onOpenPrintModal={openPrintModal}
              onCreateAccount={handleCreateAccount}
              onSelectAccountForLedger={(id) => setActiveView('ledger')}
              showToast={showToast}
            />
          )}

          {activeView === 'invoicing' && (
            <InvoicingView
              company={activeCompany}
              invoices={invoices}
              customers={customers}
              products={products}
              accounts={accounts}
              onRefresh={loadInitialData}
              onOpenPrintModal={openPrintModal}
              onCreateInvoice={handleCreateInvoice}
              onRecordPayment={handleRecordCustomerPayment}
              onCreateCustomer={handleCreateCustomer}
              showToast={showToast}
            />
          )}

          {activeView === 'purchases' && (
            <PurchasesView
              company={activeCompany}
              bills={bills}
              suppliers={suppliers}
              products={products}
              accounts={accounts}
              onRefresh={loadInitialData}
              onOpenPrintModal={openPrintModal}
              onCreateBill={handleCreateBill}
              onCreateSupplier={handleCreateSupplier}
              showToast={showToast}
            />
          )}

          {activeView === 'inventory' && (
            <InventoryView
              company={activeCompany}
              products={products}
              accounts={accounts}
              onRefresh={loadInitialData}
              onOpenPrintModal={openPrintModal}
              onCreateProduct={handleCreateProduct}
              showToast={showToast}
            />
          )}

          {activeView === 'statements' && (
            <FinancialStatementsView
              company={activeCompany}
              trialBalanceData={trialBalanceData}
              incomeStatementData={incomeStatementData}
              balanceSheetData={balanceSheetData}
              cashFlowData={cashFlowData}
              onRefresh={loadInitialData}
              onOpenPrintModal={openPrintModal}
            />
          )}

          {activeView === 'bank-rec' && (
            <BankReconciliationView
              company={activeCompany}
              accounts={accounts}
              reconciliations={reconciliations}
              onRefresh={loadInitialData}
              onOpenPrintModal={openPrintModal}
              onSaveReconciliation={handleSaveReconciliation}
              showToast={showToast}
            />
          )}

          {activeView === 'assets' && (
            <FixedAssetsView
              company={activeCompany}
              assets={fixedAssets}
              accounts={accounts}
              onRefresh={loadInitialData}
              onOpenPrintModal={openPrintModal}
              onPostDepreciation={handlePostDepreciation}
              showToast={showToast}
            />
          )}

          {activeView === 'audit-settings' && (
            <AuditAndSettingsView
              company={activeCompany}
              auditLogs={auditLogs}
              onRefresh={loadInitialData}
              onUpdateCompany={handleUpdateCompany}
              onOpenNewCompanyModal={() => setShowNewCompanyModal(true)}
              showToast={showToast}
            />
          )}
        </main>

        {/* Mobile Bottom Navigation Bar (Hidden on lg+ screens) */}
        <MobileBottomNav
          activeView={activeView}
          setActiveView={setActiveView}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />
      </div>

      {/* Printable Document Modal */}
      <PrintDocumentModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        company={activeCompany}
        document={printDoc}
      />

      {/* Register New Company Modal */}
      {showNewCompanyModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold tracking-tight">Register New Company / Entity</h3>
                <p className="text-[11px] text-slate-400">Creates isolated chart of accounts and double-entry books</p>
              </div>
              <button
                onClick={() => setShowNewCompanyModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateCompanySubmit} className="p-4 sm:p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company Legal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Horizon Logistics LLC"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded font-semibold text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Base Currency Code</label>
                  <input
                    type="text"
                    required
                    value={newCompanyCurrency}
                    onChange={(e) => setNewCompanyCurrency(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-300 rounded font-mono uppercase text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Currency Symbol</label>
                  <input
                    type="text"
                    required
                    value={newCompanySymbol}
                    onChange={(e) => setNewCompanySymbol(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded font-mono text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewCompanyModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 font-medium min-h-[40px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 font-semibold shadow-xs min-h-[40px]"
                >
                  Create Entity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
