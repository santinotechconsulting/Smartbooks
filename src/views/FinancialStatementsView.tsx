import React, { useState } from 'react';
import {
  Scale,
  FileText,
  Download,
  Printer,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  ShieldCheck,
} from 'lucide-react';
import { Company } from '../types.ts';
import { formatMoney, downloadCSV } from '../utils/export.ts';

interface FinancialStatementsViewProps {
  company: Company | null;
  trialBalanceData: any;
  incomeStatementData: any;
  balanceSheetData: any;
  cashFlowData: any;
  onRefresh: () => void;
  onOpenPrintModal: (doc: any) => void;
}

export const FinancialStatementsView: React.FC<FinancialStatementsViewProps> = ({
  company,
  trialBalanceData,
  incomeStatementData,
  balanceSheetData,
  cashFlowData,
  onRefresh,
  onOpenPrintModal,
}) => {
  const currencySymbol = company?.currencySymbol || '$';
  const [statementTab, setStatementTab] = useState<'TB' | 'IS' | 'BS' | 'CF'>('TB');

  const tabs = [
    { id: 'TB', label: '1. Trial Balance' },
    { id: 'IS', label: '2. Income Statement (P&L)' },
    { id: 'BS', label: '3. Statement of Financial Position (Balance Sheet)' },
    { id: 'CF', label: '4. Statement of Cash Flows' },
  ];

  // ==========================================
  // Print & Export Handlers
  // ==========================================

  // Trial Balance Print
  const printTrialBalance = () => {
    if (!trialBalanceData) return;
    onOpenPrintModal({
      title: 'Adjusted Trial Balance',
      documentNumber: `TB-${new Date().getFullYear()}`,
      date: trialBalanceData.asOfDate,
      description: `Double-entry balance verification across all ledger accounts`,
      columns: [
        { header: 'Account Code', key: 'code' },
        { header: 'Account Name', key: 'name' },
        { header: 'Class', key: 'type' },
        { header: 'Period Debit', key: 'periodDebit', align: 'right' },
        { header: 'Period Credit', key: 'periodCredit', align: 'right' },
        { header: 'Closing Debit', key: 'closingDebit', align: 'right' },
        { header: 'Closing Credit', key: 'closingCredit', align: 'right' },
      ],
      rows: trialBalanceData.rows.map((r: any) => ({
        code: r.code,
        name: r.name,
        type: r.type,
        periodDebit: r.periodDebit > 0 ? formatMoney(r.periodDebit, currencySymbol) : '-',
        periodCredit: r.periodCredit > 0 ? formatMoney(r.periodCredit, currencySymbol) : '-',
        closingDebit: r.closingDebit > 0 ? formatMoney(r.closingDebit, currencySymbol) : '-',
        closingCredit: r.closingCredit > 0 ? formatMoney(r.closingCredit, currencySymbol) : '-',
      })),
      totals: [
        { label: 'Total Debits', value: formatMoney(trialBalanceData.grandTotalDebit, currencySymbol) },
        { label: 'Total Credits', value: formatMoney(trialBalanceData.grandTotalCredit, currencySymbol) },
        { label: 'Difference', value: formatMoney(trialBalanceData.difference, currencySymbol) },
      ],
      notes: trialBalanceData.isBalanced
        ? 'Trial Balance is verified: Total Debits equal Total Credits.'
        : 'WARNING: Trial Balance is out of balance.',
    });
  };

  // Income Statement Print
  const printIncomeStatement = () => {
    if (!incomeStatementData) return;
    onOpenPrintModal({
      title: 'Statement of Profit or Loss (Income Statement)',
      documentNumber: `IS-${new Date().getFullYear()}`,
      date: incomeStatementData.endDate,
      description: `For the period ${incomeStatementData.startDate} to ${incomeStatementData.endDate}`,
      columns: [
        { header: 'Particulars', key: 'name' },
        { header: 'Reporting Classification', key: 'category' },
        { header: 'Amount', key: 'amount', align: 'right' },
      ],
      rows: [
        ...incomeStatementData.revenues.map((r: any) => ({ name: r.name, category: 'Sales Revenue', amount: formatMoney(r.amount, currencySymbol) })),
        ...incomeStatementData.cogs.map((c: any) => ({ name: c.name, category: 'Cost of Goods Sold', amount: `(${formatMoney(c.amount, currencySymbol)})` })),
        ...incomeStatementData.operatingExpenses.map((o: any) => ({ name: o.name, category: 'Operating Expense', amount: `(${formatMoney(o.amount, currencySymbol)})` })),
      ],
      totals: [
        { label: 'Total Revenue', value: formatMoney(incomeStatementData.totalRevenue, currencySymbol) },
        { label: 'Cost of Goods Sold', value: `(${formatMoney(incomeStatementData.totalCogs, currencySymbol)})` },
        { label: 'Gross Profit', value: formatMoney(incomeStatementData.grossProfit, currencySymbol) },
        { label: 'Total Operating Expenses', value: `(${formatMoney(incomeStatementData.totalOperatingExpenses, currencySymbol)})` },
        { label: 'Operating Profit (EBIT)', value: formatMoney(incomeStatementData.operatingProfit, currencySymbol) },
        { label: 'Tax Provision (15%)', value: `(${formatMoney(incomeStatementData.taxExpense, currencySymbol)})` },
        { label: 'Net Profit / (Loss)', value: formatMoney(incomeStatementData.netProfitOrLoss, currencySymbol) },
      ],
    });
  };

  // Balance Sheet Print
  const printBalanceSheet = () => {
    if (!balanceSheetData) return;
    onOpenPrintModal({
      title: 'Statement of Financial Position (Balance Sheet)',
      documentNumber: `BS-${new Date().getFullYear()}`,
      date: balanceSheetData.asOfDate,
      description: `As of ${balanceSheetData.asOfDate} · Strict Accounting Equation ASSETS = LIABILITIES + EQUITY`,
      columns: [
        { header: 'Classification & Particulars', key: 'name' },
        { header: 'Account Group', key: 'category' },
        { header: 'Net Amount', key: 'balance', align: 'right' },
      ],
      rows: [
        ...balanceSheetData.currentAssets.map((a: any) => ({ name: a.name, category: 'Current Asset', balance: formatMoney(a.balance, currencySymbol) })),
        ...balanceSheetData.nonCurrentAssets.map((a: any) => ({ name: a.name, category: 'Non-Current Asset', balance: formatMoney(a.balance, currencySymbol) })),
        ...balanceSheetData.currentLiabilities.map((l: any) => ({ name: l.name, category: 'Current Liability', balance: formatMoney(l.balance, currencySymbol) })),
        ...balanceSheetData.nonCurrentLiabilities.map((l: any) => ({ name: l.name, category: 'Non-Current Liability', balance: formatMoney(l.balance, currencySymbol) })),
        ...balanceSheetData.equityItems.map((e: any) => ({ name: e.name, category: 'Equity', balance: formatMoney(e.balance, currencySymbol) })),
        { name: 'Current Period Retained Profit', category: 'Retained Earnings', balance: formatMoney(balanceSheetData.currentPeriodEarnings, currencySymbol) },
      ],
      totals: [
        { label: 'TOTAL ASSETS', value: formatMoney(balanceSheetData.totalAssets, currencySymbol) },
        { label: 'Total Liabilities', value: formatMoney(balanceSheetData.totalLiabilities, currencySymbol) },
        { label: 'Total Equity', value: formatMoney(balanceSheetData.totalEquity, currencySymbol) },
        { label: 'TOTAL LIABILITIES & EQUITY', value: formatMoney(balanceSheetData.totalLiabilitiesAndEquity, currencySymbol) },
        { label: 'Accounting Equation Difference', value: formatMoney(balanceSheetData.difference, currencySymbol) },
      ],
      notes: balanceSheetData.isBalanced
        ? 'Statement of Financial Position is balanced: Assets equal Liabilities + Equity.'
        : 'WARNING: Statement of Financial Position shows a variance.',
    });
  };

  // Cash Flow Print
  const printCashFlow = () => {
    if (!cashFlowData) return;
    onOpenPrintModal({
      title: 'Statement of Cash Flows',
      documentNumber: `CF-${new Date().getFullYear()}`,
      date: cashFlowData.endDate,
      description: `Cash movements across Operating, Investing, and Financing activities`,
      columns: [
        { header: 'Cash Flow Particulars', key: 'description' },
        { header: 'Cash Inflow / (Outflow)', key: 'amount', align: 'right' },
      ],
      rows: (cashFlowData.operatingActivities || []).map((o: any) => ({
        description: o.description,
        amount: formatMoney(o.amount, currencySymbol),
      })),
      totals: [
        { label: 'Cash from Operating Activities', value: formatMoney(cashFlowData.totalOperating, currencySymbol) },
        { label: 'Cash from Investing Activities', value: formatMoney(cashFlowData.totalInvesting, currencySymbol) },
        { label: 'Cash from Financing Activities', value: formatMoney(cashFlowData.totalFinancing, currencySymbol) },
        { label: 'Net Change in Cash and Cash Equivalents', value: formatMoney(cashFlowData.netChangeInCash, currencySymbol) },
      ],
    });
  };

  return (
    <div className="space-y-6">
      {/* Statement Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setStatementTab(t.id as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                statementTab === t.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {statementTab === 'TB' && (
            <button
              onClick={printTrialBalance}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Trial Balance</span>
            </button>
          )}
          {statementTab === 'IS' && (
            <button
              onClick={printIncomeStatement}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Income Statement</span>
            </button>
          )}
          {statementTab === 'BS' && (
            <button
              onClick={printBalanceSheet}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Balance Sheet</span>
            </button>
          )}
          {statementTab === 'CF' && (
            <button
              onClick={printCashFlow}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Cash Flow</span>
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. TRIAL BALANCE TAB */}
      {/* ------------------------------------------------------------- */}
      {statementTab === 'TB' && (
        <div className="space-y-4">
          {/* Verification Banner */}
          <div
            className={`p-4 rounded-lg border flex items-center justify-between ${
              trialBalanceData?.isBalanced
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            <div className="flex items-center gap-3">
              {trialBalanceData?.isBalanced ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              )}
              <div>
                <h4 className="text-sm font-bold">
                  {trialBalanceData?.isBalanced
                    ? 'Trial Balance is in Exact Double-Entry Balance'
                    : 'Discrepancy Detected in Trial Balance'}
                </h4>
                <p className="text-xs opacity-80 mt-0.5">
                  Total Debits:{' '}
                  <span className="font-mono font-semibold">
                    {formatMoney(trialBalanceData?.grandTotalDebit || 0, currencySymbol)}
                  </span>{' '}
                  · Total Credits:{' '}
                  <span className="font-mono font-semibold">
                    {formatMoney(trialBalanceData?.grandTotalCredit || 0, currencySymbol)}
                  </span>{' '}
                  · Difference: <span className="font-mono font-semibold">$0.00</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold text-center">
                    <th colSpan={3} className="py-2 px-3 border-r border-slate-200 text-left">
                      Account Master
                    </th>
                    <th colSpan={2} className="py-2 px-3 border-r border-slate-200">
                      Period Movements
                    </th>
                    <th colSpan={2} className="py-2 px-3 bg-slate-200/60">
                      Closing Balances
                    </th>
                  </tr>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-left">
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Account Title</th>
                    <th className="py-2.5 px-3 border-r border-slate-200">Class</th>
                    <th className="py-2.5 px-3 text-right">Debit Movement</th>
                    <th className="py-2.5 px-3 text-right border-r border-slate-200">Credit Movement</th>
                    <th className="py-2.5 px-3 text-right font-mono font-bold bg-slate-100/50">Debit Balance</th>
                    <th className="py-2.5 px-3 text-right font-mono font-bold bg-slate-100/50">Credit Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trialBalanceData?.rows.map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2 px-3 font-mono font-bold text-slate-900">{r.code}</td>
                      <td className="py-2 px-3 font-semibold text-slate-800">{r.name}</td>
                      <td className="py-2 px-3 border-r border-slate-200 text-slate-500">{r.type}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                        {r.periodDebit ? formatMoney(r.periodDebit, currencySymbol) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700 border-r border-slate-200">
                        {r.periodCredit ? formatMoney(r.periodCredit, currencySymbol) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900 bg-slate-50/40">
                        {r.closingDebit ? formatMoney(r.closingDebit, currencySymbol) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900 bg-slate-50/40">
                        {r.closingCredit ? formatMoney(r.closingCredit, currencySymbol) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-900 font-extrabold text-slate-900 text-xs">
                    <td colSpan={5} className="py-3 px-3 text-right uppercase tracking-wider">
                      TOTAL TRIAL BALANCE:
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-sm">
                      {formatMoney(trialBalanceData?.grandTotalDebit, currencySymbol)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-sm">
                      {formatMoney(trialBalanceData?.grandTotalCredit, currencySymbol)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. INCOME STATEMENT (P&L) TAB */}
      {/* ------------------------------------------------------------- */}
      {statementTab === 'IS' && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs max-w-4xl mx-auto space-y-6">
          <div className="text-center pb-4 border-b border-slate-200">
            <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
              STATEMENT OF PROFIT OR LOSS (INCOME STATEMENT)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Period: {incomeStatementData?.startDate} to {incomeStatementData?.endDate} · Currency: {company?.currency || 'USD'}
            </p>
          </div>

          <div className="space-y-6 text-xs">
            {/* 1. Revenues */}
            <div>
              <div className="flex justify-between items-center font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1.5 mb-2">
                <span>Revenue &amp; Turnover</span>
                <span>Amount ({currencySymbol})</span>
              </div>
              <div className="space-y-1.5 pl-3">
                {incomeStatementData?.revenues.map((r: any) => (
                  <div key={r.id} className="flex justify-between text-slate-700">
                    <span>[{r.code}] {r.name}</span>
                    <span className="font-mono tabular-nums">{formatMoney(r.amount, currencySymbol)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-100 mt-2">
                <span>Total Operating Revenue:</span>
                <span className="font-mono tabular-nums font-extrabold">
                  {formatMoney(incomeStatementData?.totalRevenue, currencySymbol)}
                </span>
              </div>
            </div>

            {/* 2. Cost of Goods Sold */}
            <div>
              <div className="flex justify-between items-center font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1.5 mb-2">
                <span>Cost of Goods Sold (COGS)</span>
                <span>Amount ({currencySymbol})</span>
              </div>
              <div className="space-y-1.5 pl-3">
                {incomeStatementData?.cogs.map((c: any) => (
                  <div key={c.id} className="flex justify-between text-slate-700">
                    <span>[{c.code}] {c.name}</span>
                    <span className="font-mono tabular-nums text-slate-700">
                      ({formatMoney(c.amount, currencySymbol)})
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-100 mt-2">
                <span>Total Cost of Goods Sold:</span>
                <span className="font-mono tabular-nums font-extrabold text-slate-700">
                  ({formatMoney(incomeStatementData?.totalCogs, currencySymbol)})
                </span>
              </div>
            </div>

            {/* Gross Profit Callout */}
            <div className="p-3 bg-emerald-50 rounded-md border border-emerald-200 flex justify-between items-center text-sm font-extrabold text-emerald-950">
              <span>GROSS PROFIT / MARGIN:</span>
              <span className="font-mono tabular-nums text-base">
                {formatMoney(incomeStatementData?.grossProfit, currencySymbol)}
              </span>
            </div>

            {/* 3. Operating Expenses */}
            <div>
              <div className="flex justify-between items-center font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1.5 mb-2">
                <span>Operating &amp; Administrative Expenses</span>
                <span>Amount ({currencySymbol})</span>
              </div>
              <div className="space-y-1.5 pl-3">
                {incomeStatementData?.operatingExpenses.map((o: any) => (
                  <div key={o.id} className="flex justify-between text-slate-700">
                    <span>[{o.code}] {o.name}</span>
                    <span className="font-mono tabular-nums">({formatMoney(o.amount, currencySymbol)})</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-100 mt-2">
                <span>Total Operating Expenses:</span>
                <span className="font-mono tabular-nums font-extrabold">
                  ({formatMoney(incomeStatementData?.totalOperatingExpenses, currencySymbol)})
                </span>
              </div>
            </div>

            {/* Operating Profit */}
            <div className="flex justify-between items-center font-bold text-slate-900 border-t border-slate-300 pt-2 text-xs">
              <span>OPERATING PROFIT (EBIT):</span>
              <span className="font-mono tabular-nums font-bold">
                {formatMoney(incomeStatementData?.operatingProfit, currencySymbol)}
              </span>
            </div>

            {/* Tax */}
            <div className="flex justify-between items-center text-slate-600">
              <span>Income Tax Provision (Estimated 15%):</span>
              <span className="font-mono tabular-nums">
                ({formatMoney(incomeStatementData?.taxExpense, currencySymbol)})
              </span>
            </div>

            {/* Net Profit */}
            <div className="p-4 bg-slate-900 text-white rounded-md flex justify-between items-center text-sm font-extrabold">
              <span>NET PROFIT / (LOSS) FOR THE PERIOD:</span>
              <span
                className={`font-mono tabular-nums text-lg ${
                  incomeStatementData?.netProfitOrLoss >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {formatMoney(incomeStatementData?.netProfitOrLoss, currencySymbol)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. STATEMENT OF FINANCIAL POSITION (BALANCE SHEET) */}
      {/* ------------------------------------------------------------- */}
      {statementTab === 'BS' && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs max-w-4xl mx-auto space-y-6">
          <div className="text-center pb-4 border-b border-slate-200">
            <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
              STATEMENT OF FINANCIAL POSITION (BALANCE SHEET)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              As of {balanceSheetData?.asOfDate} · Strict Accounting Rule: ASSETS = LIABILITIES + EQUITY
            </p>
          </div>

          {/* Equation Verification Badge */}
          <div
            className={`p-3 rounded-md border flex items-center justify-between text-xs ${
              balanceSheetData?.isBalanced
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {balanceSheetData?.isBalanced ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600" />
              )}
              <span className="font-bold">
                {balanceSheetData?.isBalanced
                  ? 'Accounting Equation Balanced: Assets = Liabilities + Equity'
                  : 'Equation Variance Detected'}
              </span>
            </div>
            <span className="font-mono font-bold">
              Diff: {formatMoney(balanceSheetData?.difference, currencySymbol)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
            {/* LEFT COLUMN: ASSETS */}
            <div className="space-y-4">
              <h4 className="font-extrabold text-slate-900 uppercase tracking-wider border-b-2 border-slate-900 pb-1 text-sm">
                ASSETS
              </h4>

              {/* Current Assets */}
              <div>
                <span className="font-bold text-slate-800 block mb-1">Current Assets</span>
                <div className="space-y-1 pl-2">
                  {balanceSheetData?.currentAssets.map((a: any) => (
                    <div key={a.id} className="flex justify-between text-slate-700">
                      <span>[{a.code}] {a.name}</span>
                      <span className="font-mono tabular-nums">{formatMoney(a.balance, currencySymbol)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-semibold text-slate-900 border-t border-slate-100 pt-1 mt-1 text-[11px]">
                  <span>Total Current Assets:</span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(balanceSheetData?.totalCurrentAssets, currencySymbol)}
                  </span>
                </div>
              </div>

              {/* Non-Current Assets */}
              <div>
                <span className="font-bold text-slate-800 block mb-1">Non-Current (Fixed) Assets</span>
                <div className="space-y-1 pl-2">
                  {balanceSheetData?.nonCurrentAssets.map((a: any) => (
                    <div key={a.id} className="flex justify-between text-slate-700">
                      <span>[{a.code}] {a.name}</span>
                      <span className="font-mono tabular-nums">{formatMoney(a.balance, currencySymbol)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-semibold text-slate-900 border-t border-slate-100 pt-1 mt-1 text-[11px]">
                  <span>Total Non-Current Assets:</span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(balanceSheetData?.totalNonCurrentAssets, currencySymbol)}
                  </span>
                </div>
              </div>

              {/* TOTAL ASSETS */}
              <div className="p-3 bg-slate-100 rounded border border-slate-300 flex justify-between items-center font-extrabold text-slate-900 text-sm mt-6">
                <span>TOTAL ASSETS:</span>
                <span className="font-mono tabular-nums text-base">
                  {formatMoney(balanceSheetData?.totalAssets, currencySymbol)}
                </span>
              </div>
            </div>

            {/* RIGHT COLUMN: LIABILITIES & EQUITY */}
            <div className="space-y-4">
              <h4 className="font-extrabold text-slate-900 uppercase tracking-wider border-b-2 border-slate-900 pb-1 text-sm">
                LIABILITIES &amp; EQUITY
              </h4>

              {/* Current Liabilities */}
              <div>
                <span className="font-bold text-slate-800 block mb-1">Current Liabilities</span>
                <div className="space-y-1 pl-2">
                  {balanceSheetData?.currentLiabilities.map((l: any) => (
                    <div key={l.id} className="flex justify-between text-slate-700">
                      <span>[{l.code}] {l.name}</span>
                      <span className="font-mono tabular-nums">{formatMoney(l.balance, currencySymbol)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-semibold text-slate-900 border-t border-slate-100 pt-1 mt-1 text-[11px]">
                  <span>Total Current Liabilities:</span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(balanceSheetData?.totalCurrentLiabilities, currencySymbol)}
                  </span>
                </div>
              </div>

              {/* Equity */}
              <div>
                <span className="font-bold text-slate-800 block mb-1">Stockholders' / Owner Equity</span>
                <div className="space-y-1 pl-2">
                  {balanceSheetData?.equityItems.map((e: any) => (
                    <div key={e.id} className="flex justify-between text-slate-700">
                      <span>[{e.code}] {e.name}</span>
                      <span className="font-mono tabular-nums">{formatMoney(e.balance, currencySymbol)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-emerald-800 font-semibold bg-emerald-50/60 p-1 rounded">
                    <span>Current-Year Net Profit / Earnings:</span>
                    <span className="font-mono tabular-nums">
                      {formatMoney(balanceSheetData?.currentPeriodEarnings, currencySymbol)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between font-semibold text-slate-900 border-t border-slate-100 pt-1 mt-1 text-[11px]">
                  <span>Total Equity:</span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(balanceSheetData?.totalEquity, currencySymbol)}
                  </span>
                </div>
              </div>

              {/* TOTAL LIABILITIES & EQUITY */}
              <div className="p-3 bg-slate-100 rounded border border-slate-300 flex justify-between items-center font-extrabold text-slate-900 text-sm mt-6">
                <span>TOTAL LIABILITIES &amp; EQUITY:</span>
                <span className="font-mono tabular-nums text-base">
                  {formatMoney(balanceSheetData?.totalLiabilitiesAndEquity, currencySymbol)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. STATEMENT OF CASH FLOWS */}
      {/* ------------------------------------------------------------- */}
      {statementTab === 'CF' && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs max-w-4xl mx-auto space-y-6">
          <div className="text-center pb-4 border-b border-slate-200">
            <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
              STATEMENT OF CASH FLOWS
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Period: {cashFlowData?.startDate} to {cashFlowData?.endDate} · Operating, Investing &amp; Financing (Contra Transfers Excluded)
            </p>
          </div>

          <div className="space-y-5 text-xs">
            {/* Operating */}
            <div>
              <div className="flex justify-between items-center font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1.5 mb-2">
                <span>Cash Flows from Operating Activities</span>
                <span>Inflow / (Outflow)</span>
              </div>
              <div className="space-y-1.5 pl-3">
                {cashFlowData?.operatingActivities?.map((o: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-slate-700">
                    <span className="truncate max-w-md">{o.description}</span>
                    <span className={`font-mono tabular-nums ${o.amount >= 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                      {formatMoney(o.amount, currencySymbol)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-100 mt-2">
                <span>Net Cash from Operating Activities:</span>
                <span className="font-mono tabular-nums font-extrabold">
                  {formatMoney(cashFlowData?.totalOperating, currencySymbol)}
                </span>
              </div>
            </div>

            {/* Net Change */}
            <div className="p-4 bg-slate-900 text-white rounded-md flex justify-between items-center text-sm font-extrabold">
              <span>NET CHANGE IN CASH &amp; CASH EQUIVALENTS:</span>
              <span className="font-mono tabular-nums text-lg text-emerald-400">
                {formatMoney(cashFlowData?.netChangeInCash, currencySymbol)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
