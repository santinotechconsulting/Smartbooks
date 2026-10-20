import React from 'react';
import {
  LayoutDashboard,
  Wallet,
  BookOpen,
  Scale,
  Menu,
} from 'lucide-react';

interface MobileBottomNavProps {
  activeView: string;
  setActiveView: (view: string) => void;
  onOpenMobileMenu: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView,
  setActiveView,
  onOpenMobileMenu,
}) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'cash-book', label: 'Cash Book', icon: Wallet },
    { id: 'journal', label: 'Journal', icon: BookOpen },
    { id: 'statements', label: 'Reports', icon: Scale },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-1 pt-1 pb-[calc(0.4rem+env(safe-area-inset-bottom,0px))] shadow-lg no-print select-none">
      <div className="grid grid-cols-5 items-center h-13 sm:h-14">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className={`flex flex-col items-center justify-center h-full w-full rounded-lg transition-all min-h-[44px] relative ${
                isActive
                  ? 'text-emerald-700 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {isActive && (
                <span className="absolute top-1 w-6 h-0.5 bg-emerald-600 rounded-full" />
              )}
              <Icon
                className={`w-5 h-5 transition-transform ${
                  isActive ? 'text-emerald-700 stroke-[2.2] scale-105' : 'text-slate-500'
                }`}
              />
              <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-full px-1">
                {tab.label}
              </span>
            </button>
          );
        })}

        {/* All Modules / Drawer Button */}
        <button
          onClick={onOpenMobileMenu}
          className="flex flex-col items-center justify-center h-full w-full rounded-lg text-slate-600 hover:text-slate-900 transition-colors min-h-[44px]"
          aria-label="Open full modules navigation"
        >
          <Menu className="w-5 h-5 text-slate-600" />
          <span className="text-[10px] mt-0.5 tracking-tight truncate">
            All Modules
          </span>
        </button>
      </div>
    </nav>
  );
};
