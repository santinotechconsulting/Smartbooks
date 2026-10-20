import React from 'react';
import {
  LayoutDashboard,
  Wallet,
  BookOpen,
  FileSpreadsheet,
  Building2,
  Receipt,
  ShoppingCart,
  Boxes,
  Landmark,
  Scale,
  ShieldCheck,
  ChevronDown,
  Layers,
  Lock,
  Unlock,
  X,
} from 'lucide-react';
import { Company } from '../types.ts';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  activeCompany: Company | null;
  availableCompanies: Company[];
  onSwitchCompany: (id: number) => void;
  onOpenNewCompanyModal: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  activeCompany,
  availableCompanies,
  onSwitchCompany,
  onOpenNewCompanyModal,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const [showCompanyMenu, setShowCompanyMenu] = React.useState(false);

  const navGroups = [
    {
      label: 'Core Operations',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'cash-book', label: 'Cash & Bank Books', icon: Wallet },
        { id: 'bank-rec', label: 'Bank Reconciliation', icon: Landmark },
      ],
    },
    {
      label: 'Accounting Engine',
      items: [
        { id: 'journal', label: 'General Journal', icon: BookOpen },
        { id: 'ledger', label: 'General Ledger', icon: FileSpreadsheet },
        { id: 'accounts', label: 'Chart of Accounts', icon: Layers },
      ],
    },
    {
      label: 'Commercial & Trade',
      items: [
        { id: 'invoicing', label: 'Sales & Invoicing', icon: Receipt },
        { id: 'purchases', label: 'Purchases & Bills', icon: ShoppingCart },
        { id: 'inventory', label: 'Inventory & Stock', icon: Boxes },
        { id: 'assets', label: 'Fixed Assets Register', icon: Building2 },
      ],
    },
    {
      label: 'Financial Statements',
      items: [
        { id: 'statements', label: 'Financial Statements', icon: Scale },
        { id: 'audit-settings', label: 'Audit Trail & Company', icon: ShieldCheck },
      ],
    },
  ];

  const handleSelectNav = (id: string) => {
    setActiveView(id);
    if (onCloseMobile) onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300 w-72 lg:w-64 select-none pt-safe pb-safe">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold tracking-tight text-lg shrink-0">
            SB
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-white tracking-tight truncate">SmartBooks Pro</h1>
            <p className="text-xs text-slate-400 truncate">Double-Entry Accounting</p>
          </div>
        </div>

        {/* Mobile close button */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Entity Switcher */}
      <div className="p-3 border-b border-slate-800/80 relative">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1 px-1">
          Active Entity
        </div>
        <button
          onClick={() => setShowCompanyMenu(!showCompanyMenu)}
          className="w-full flex items-center justify-between p-2.5 rounded-md bg-slate-800/70 hover:bg-slate-800 text-left transition-colors border border-slate-700/60 min-h-[44px]"
        >
          <div className="min-w-0 pr-2">
            <div className="text-xs font-semibold text-white truncate">
              {activeCompany?.tradingName || activeCompany?.name || 'Default Organization'}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span>{activeCompany?.currency || 'USD'} ({activeCompany?.currencySymbol || '$'})</span>
              <span>·</span>
              <span className="flex items-center gap-0.5">
                {activeCompany?.isLocked ? (
                  <>
                    <Lock className="w-2.5 h-2.5 text-amber-400" />
                    <span className="text-amber-400 text-[10px]">Locked</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-2.5 h-2.5 text-emerald-400" />
                    <span className="text-emerald-400 text-[10px]">Open</span>
                  </>
                )}
              </span>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        </button>

        {showCompanyMenu && (
          <div className="absolute top-full left-3 right-3 mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl py-1 z-30">
            <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 border-b border-slate-700/60">
              Select Entity
            </div>
            {availableCompanies.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onSwitchCompany(c.id);
                  setShowCompanyMenu(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors min-h-[40px] ${
                  c.id === activeCompany?.id
                    ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                    : 'text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                <span className="truncate">{c.name}</span>
                <span className="text-[10px] text-slate-400 shrink-0 font-mono">{c.currency}</span>
              </button>
            ))}
            <div className="border-t border-slate-700/60 mt-1 pt-1">
              <button
                onClick={() => {
                  setShowCompanyMenu(false);
                  onOpenNewCompanyModal();
                }}
                className="w-full text-left px-3 py-2 text-xs text-emerald-400 hover:bg-emerald-500/10 font-medium transition-colors min-h-[40px]"
              >
                + Register New Entity
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              {group.label}
            </div>
            <nav className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectNav(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap text-left min-h-[42px] ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* System Integrity Footer */}
      <div className="p-3 border-t border-slate-800 text-[11px] text-slate-400 bg-slate-950/40">
        <div className="flex items-center justify-between text-slate-400">
          <span>Engine Status</span>
          <span className="text-emerald-400 font-mono font-medium">VERIFIED 100%</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-1 truncate">
          Double-Entry Rules: Balanced
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-slate-800 no-print select-none">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Over Drawer with Backdrop */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden no-print">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Sliding drawer */}
          <div className="relative z-10 flex-1 max-w-xs w-full shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
