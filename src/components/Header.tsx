import React from 'react';
import { Plus, Shield, RefreshCw, Menu } from 'lucide-react';
import { Company } from '../types.ts';

interface HeaderProps {
  activeView: string;
  activeCompany: Company | null;
  userRole: string;
  setUserRole: (role: string) => void;
  onOpenQuickJournal: () => void;
  onOpenQuickCash: () => void;
  onRefreshData: () => void;
  isRefreshing?: boolean;
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  activeCompany,
  userRole,
  setUserRole,
  onOpenQuickJournal,
  onOpenQuickCash,
  onRefreshData,
  isRefreshing = false,
  onToggleMobileMenu,
}) => {
  const [showQuickMenu, setShowQuickMenu] = React.useState(false);

  const viewTitles: Record<string, { title: string; subtitle: string }> = {
    dashboard: { title: 'Executive Dashboard', subtitle: 'Real-time overview of cash position, solvency, and ledger integrity' },
    'cash-book': { title: 'Cash & Bank Books', subtitle: 'Single, double, three-column and petty cash records with contra tracking' },
    'bank-rec': { title: 'Bank Reconciliation', subtitle: 'Match bank statement balances with general cash book records' },
    journal: { title: 'General Journal', subtitle: 'Double-entry transaction register with debit/credit balance enforcement' },
    ledger: { title: 'General Ledger', subtitle: 'Comprehensive transaction history, movements, and running balances by account' },
    accounts: { title: 'Chart of Accounts', subtitle: 'Account classification, reporting groups, and live ledger balances' },
    invoicing: { title: 'Sales & Invoicing', subtitle: 'Customer invoicing, credit sales, cash receipts, and customer ageing' },
    purchases: { title: 'Purchases & Bills', subtitle: 'Supplier bills, credit purchases, payment vouchers, and payables ageing' },
    inventory: { title: 'Inventory & Stock', subtitle: 'Stock valuation, movement audit logs, and perpetual inventory COGS' },
    assets: { title: 'Fixed Assets', subtitle: 'Asset capitalization, useful lives, and automated depreciation schedules' },
    statements: { title: 'Financial Statements', subtitle: 'Trial balance, profit & loss, balance sheet, and cash flow reports' },
    'audit-settings': { title: 'Audit & Settings', subtitle: 'Tamper-evident logs, accounting period lock, and entity profile' },
  };

  const current = viewTitles[activeView] || { title: 'Accounting System', subtitle: 'Double-entry management' };

  return (
    <header className="h-14 sm:h-16 bg-white border-b border-slate-200 px-2.5 sm:px-6 flex items-center justify-between gap-1.5 sm:gap-4 shrink-0 no-print z-20 pt-safe">
      {/* Left: Hamburger (Mobile) + Breadcrumb & Title */}
      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="min-w-0">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700 truncate max-w-[140px]">{activeCompany?.name || 'SmartBooks'}</span>
            <span aria-hidden="true">/</span>
            <span className="capitalize">{activeView.replace('-', ' ')}</span>
          </div>
          <h2 className="text-xs sm:text-base font-bold text-slate-900 tracking-tight truncate">
            {current.title}
          </h2>
        </div>
      </div>

      {/* Right Action Zone */}
      <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
        {/* Refresh Button */}
        <button
          onClick={onRefreshData}
          disabled={isRefreshing}
          title="Refresh Financial Data"
          className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
        </button>

        {/* Role Selector */}
        <div className="flex items-center bg-slate-100 p-0.5 sm:p-1 rounded-lg border border-slate-200">
          <Shield className="w-3.5 h-3.5 text-slate-500 ml-1.5 hidden md:block" />
          <span className="text-[11px] font-medium text-slate-600 mr-1 hidden md:inline">Role:</span>
          <select
            value={userRole}
            onChange={(e) => setUserRole(e.target.value)}
            className="text-[11px] sm:text-xs bg-white text-slate-800 font-medium py-1 px-1 sm:px-2 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400 max-w-[80px] xs:max-w-[95px] sm:max-w-none"
          >
            <option value="super_admin">Admin</option>
            <option value="accountant">Accountant</option>
            <option value="bookkeeper">Bookkeeper</option>
            <option value="cashier">Cashier</option>
            <option value="auditor">Auditor</option>
          </select>
        </div>

        {/* Primary Action Button */}
        <div className="relative">
          <button
            onClick={() => setShowQuickMenu(!showQuickMenu)}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-xs whitespace-nowrap min-h-[40px]"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">+ Record Entry</span>
            <span className="sm:hidden font-bold">+ Entry</span>
          </button>

          {showQuickMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-30">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                Quick Transaction
              </div>
              <button
                onClick={() => {
                  setShowQuickMenu(false);
                  onOpenQuickJournal();
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex flex-col min-h-[44px]"
              >
                <span className="font-medium">General Journal Entry</span>
                <span className="text-[11px] text-slate-400">Multi-line balanced debit/credit</span>
              </button>
              <button
                onClick={() => {
                  setShowQuickMenu(false);
                  onOpenQuickCash();
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex flex-col border-t border-slate-100 min-h-[44px]"
              >
                <span className="font-medium">Cash / Bank Voucher</span>
                <span className="text-[11px] text-slate-400">Receipt, payment, or contra</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
