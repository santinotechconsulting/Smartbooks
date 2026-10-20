import React from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  ShoppingCart,
  FileText,
  Building,
  TrendingUp,
} from 'lucide-react';
import { Company, JournalEntry, Account } from '../types.ts';
import { formatMoney } from '../utils/export.ts';

interface DashboardViewProps {
  company: Company | null;
  accounts: Account[];
  journals: JournalEntry[];
  trialBalanceData: any;
  balanceSheetData: any;
  incomeStatementData: any;
  onNavigate: (view: string) => void;
  onOpenQuickJournal: () => void;
  onOpenQuickCash: () => void;
  onOpenQuickInvoice: () => void;
  onViewJournal: (entry: JournalEntry) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  company,
  accounts,
  journals,
  trialBalanceData,
  balanceSheetData,
  incomeStatementData,
  onNavigate,
  onOpenQuickJournal,
  onOpenQuickCash,
  onOpenQuickInvoice,
  onViewJournal,
}) => {
  const currencySymbol = company?.currencySymbol || '$';

  // Calculate Cash & Bank from accounts
  const cashAccounts = accounts.filter((a) => a.category === 'Cash & Bank');
  const totalCashBank = cashAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);

  // Accounts Receivable (1200)
  const arAccount = accounts.find((a) => a.code === '1200');
  const totalAR = arAccount?.balance || 0;

  // Accounts Payable (2010)
  const apAccount = accounts.find((a) => a.code === '2010');
  const totalAP = apAccount?.balance || 0;

  // Financial Statement Metrics
  const totalRevenue = incomeStatementData?.totalRevenue || 0;
  const netProfit = incomeStatementData?.netProfitOrLoss || 0;
  const currentAssets = balanceSheetData?.totalCurrentAssets || 0;
  const currentLiabilities = balanceSheetData?.totalCurrentLiabilities || 0;
  const workingCapital = currentAssets - currentLiabilities;

  // Accounting Integrity Status
  const tbBalanced = trialBalanceData?.isBalanced ?? true;
  const bsBalanced = balanceSheetData?.isBalanced ?? true;

  return (
    <div className="space-y-6">
      {/* Ledger Integrity Diagnostic Strip */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${
                tbBalanced && bsBalanced
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {tbBalanced && bsBalanced ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Double-Entry Ledger Status: {tbBalanced && bsBalanced ? 'Fully Balanced' : 'Review Required'}
                </h3>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs font-mono text-slate-600">
                  Debits = Credits: {tbBalanced ? 'VERIFIED' : 'MISMATCH'}
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs font-mono text-slate-600">
                  Assets = Liab + Equity: {bsBalanced ? 'VERIFIED' : 'MISMATCH'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                All transactions are verified against double-entry equations. Total posted journals: {journals.length}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('statements')}
              className="text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md transition-colors"
            >
              Inspect Trial Balance
            </button>
            <button
              onClick={onOpenQuickJournal}
              className="text-xs font-semibold px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md transition-colors"
            >
              + Record Journal
            </button>
          </div>
        </div>
      </div>

      {/* Primary Financial Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Cash & Bank Position */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-medium">Total Cash &amp; Bank Holdings</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatMoney(totalCashBank, currencySymbol)}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
            <span>Operating Float: {formatMoney(accounts.find((a) => a.code === '1030')?.balance || 0, currencySymbol)}</span>
          </div>
        </div>

        {/* Metric 2: Accounts Receivable */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-medium">Accounts Receivable (Debtors)</span>
            <ArrowUpRight className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatMoney(totalAR, currencySymbol)}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
            <span>Customer claims awaiting settlement</span>
          </div>
        </div>

        {/* Metric 3: Accounts Payable */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-medium">Accounts Payable (Creditors)</span>
            <ArrowDownRight className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatMoney(totalAP, currencySymbol)}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
            <span>Supplier obligations pending</span>
          </div>
        </div>

        {/* Metric 4: Net Working Capital */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-medium">Net Working Capital</span>
            <Scale className="w-4 h-4 text-slate-600" />
          </div>
          <div
            className={`text-2xl font-bold font-mono tabular-nums ${
              workingCapital >= 0 ? 'text-slate-900' : 'text-red-600'
            }`}
          >
            {formatMoney(workingCapital, currencySymbol)}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
            <span>Ratio: {(currentLiabilities > 0 ? (currentAssets / currentLiabilities).toFixed(2) : 'N/A')}x</span>
          </div>
        </div>
      </div>

      {/* Secondary Metrics & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Income & PnL Summary */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs lg:col-span-1">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h3 className="text-sm font-bold text-slate-900">Trading Performance</h3>
            <span className="text-xs text-slate-500">YTD Actuals</span>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600">Gross Sales Revenue:</span>
              <span className="font-mono font-semibold text-slate-900">
                {formatMoney(totalRevenue, currencySymbol)}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600">Cost of Goods Sold (COGS):</span>
              <span className="font-mono font-semibold text-slate-700">
                ({formatMoney(incomeStatementData?.totalCogs || 0, currencySymbol)})
              </span>
            </div>
            <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-100">
              <span className="font-medium text-slate-800">Gross Margin:</span>
              <span className="font-mono font-bold text-emerald-700">
                {formatMoney(incomeStatementData?.grossProfit || 0, currencySymbol)}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600">Operating Expenses:</span>
              <span className="font-mono font-semibold text-slate-700">
                ({formatMoney(incomeStatementData?.totalOperatingExpenses || 0, currencySymbol)})
              </span>
            </div>
            <div className="flex justify-between items-center text-xs pt-2 border-t-2 border-slate-900">
              <span className="font-bold text-slate-900">Net Profit / (Loss):</span>
              <span
                className={`font-mono font-extrabold text-sm ${
                  netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {formatMoney(netProfit, currencySymbol)}
              </span>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100">
            <button
              onClick={() => onNavigate('statements')}
              className="w-full text-center text-xs font-semibold text-emerald-700 hover:text-emerald-800 py-1 transition-colors"
            >
              View Complete Income Statement →
            </button>
          </div>
        </div>

        {/* Quick Operations Strip */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900">Direct Financial Actions</h3>
              <span className="text-xs text-slate-500">Double-entry validated</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                onClick={onOpenQuickJournal}
                className="p-3 rounded-lg border border-slate-200 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50 transition-colors text-left flex flex-col"
              >
                <FileText className="w-4 h-4 text-slate-700 mb-2" />
                <span className="text-xs font-bold text-slate-900">General Journal</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Post balanced debit/credit</span>
              </button>

              <button
                onClick={onOpenQuickCash}
                className="p-3 rounded-lg border border-slate-200 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50 transition-colors text-left flex flex-col"
              >
                <Wallet className="w-4 h-4 text-emerald-600 mb-2" />
                <span className="text-xs font-bold text-slate-900">Cash &amp; Bank</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Receipt, payment, contra</span>
              </button>

              <button
                onClick={onOpenQuickInvoice}
                className="p-3 rounded-lg border border-slate-200 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50 transition-colors text-left flex flex-col"
              >
                <Receipt className="w-4 h-4 text-blue-600 mb-2" />
                <span className="text-xs font-bold text-slate-900">Sales Invoice</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Bill customer &amp; recognize tax</span>
              </button>

              <button
                onClick={() => onNavigate('purchases')}
                className="p-3 rounded-lg border border-slate-200 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50 transition-colors text-left flex flex-col"
              >
                <ShoppingCart className="w-4 h-4 text-purple-600 mb-2" />
                <span className="text-xs font-bold text-slate-900">Supplier Bill</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Record expense or inventory</span>
              </button>
            </div>
          </div>

          <div className="mt-4 p-3 bg-slate-50 rounded-md border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Financial Year End Closing: Configured for {company?.financialYearEnd || '12-31'}</span>
            </div>
            <button
              onClick={() => onNavigate('audit-settings')}
              className="text-xs font-semibold text-slate-800 hover:underline"
            >
              Configure Year-End →
            </button>
          </div>
        </div>
      </div>

      {/* Recent Posted Journals Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recent Posted Journal Entries</h3>
            <p className="text-xs text-slate-500 mt-0.5">Complete audit trail of posted transactions</p>
          </div>
          <button
            onClick={() => onNavigate('journal')}
            className="text-xs font-semibold text-slate-800 hover:text-black hover:underline"
          >
            View All Journals ({journals.length}) →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-left">
                <th className="py-2.5 px-4">Journal #</th>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Description / Source</th>
                <th className="py-2.5 px-4 text-right">Debits</th>
                <th className="py-2.5 px-4 text-right">Credits</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {journals.slice(0, 7).map((j) => {
                const totalDeb = j.lines.reduce((s, l) => s + parseFloat(l.debit || '0'), 0);
                const totalCred = j.lines.reduce((s, l) => s + parseFloat(l.credit || '0'), 0);
                return (
                  <tr key={j.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">{j.journalNumber}</td>
                    <td className="py-2.5 px-4 text-slate-600">{j.date}</td>
                    <td className="py-2.5 px-4 text-slate-800">
                      <div className="font-medium truncate max-w-md">{j.description}</div>
                      <div className="text-[10px] text-slate-400">{j.sourceDocument}</div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                      {formatMoney(totalDeb, currencySymbol)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                      {formatMoney(totalCred, currencySymbol)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          j.isReversed
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {j.isReversed ? 'REVERSED' : 'POSTED'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => onViewJournal(j)}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
                      >
                        View Lines
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
