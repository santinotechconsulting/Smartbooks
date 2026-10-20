import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Search,
  Filter,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Company, Account, JournalEntry } from '../types.ts';
import { formatMoney, downloadCSV } from '../utils/export.ts';

interface GeneralLedgerViewProps {
  company: Company | null;
  accounts: Account[];
  onOpenPrintModal: (doc: any) => void;
  onViewJournalEntry?: (journalId: number) => void;
}

export const GeneralLedgerView: React.FC<GeneralLedgerViewProps> = ({
  company,
  accounts,
  onOpenPrintModal,
  onViewJournalEntry,
}) => {
  const currencySymbol = company?.currencySymbol || '$';
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts[0] ? String(accounts[0].id) : ''
  );
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [ledgerData, setLedgerData] = useState<{
    account: Account;
    openingBalance: number;
    closingBalance: number;
    rows: any[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedAccountId) {
      fetchLedger(selectedAccountId);
    }
  }, [selectedAccountId, startDate, endDate]);

  const fetchLedger = async (accId: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      const res = await fetch(`/api/reports/general-ledger/${accId}?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLedgerData(data);
      }
    } catch (err) {
      console.error('Failed to load ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedAcc = accounts.find((a) => String(a.id) === String(selectedAccountId));

  const exportCSV = () => {
    if (!ledgerData) return;
    const headers = ['Date', 'Journal #', 'Ref / Document', 'Particulars', 'Debit', 'Credit', 'Running Balance'];
    const rows = ledgerData.rows.map((r) => [
      r.date,
      r.journalNumber,
      r.referenceNumber || '',
      r.description,
      r.debit,
      r.credit,
      r.runningBalance,
    ]);
    downloadCSV(
      `Ledger_${selectedAcc?.code}_${selectedAcc?.name.replace(/\s+/g, '_')}`,
      headers,
      rows
    );
  };

  const printLedger = () => {
    if (!ledgerData || !selectedAcc) return;
    onOpenPrintModal({
      title: `General Ledger: [${selectedAcc.code}] ${selectedAcc.name}`,
      documentNumber: `GL-${selectedAcc.code}`,
      date: new Date().toISOString().slice(0, 10),
      description: `Account Classification: ${selectedAcc.type} · Group: ${selectedAcc.category}`,
      columns: [
        { header: 'Date', key: 'date' },
        { header: 'Journal #', key: 'journalNumber' },
        { header: 'Ref / Doc', key: 'referenceNumber' },
        { header: 'Particulars', key: 'description' },
        { header: 'Debit', key: 'debit', align: 'right' },
        { header: 'Credit', key: 'credit', align: 'right' },
        { header: 'Running Balance', key: 'runningBalance', align: 'right' },
      ],
      rows: ledgerData.rows.map((r) => ({
        ...r,
        debit: r.debit > 0 ? formatMoney(r.debit, currencySymbol) : '-',
        credit: r.credit > 0 ? formatMoney(r.credit, currencySymbol) : '-',
        runningBalance: formatMoney(r.runningBalance, currencySymbol),
      })),
      totals: [
        { label: 'Opening Balance', value: formatMoney(ledgerData.openingBalance, currencySymbol) },
        {
          label: 'Total Debit Movements',
          value: formatMoney(
            ledgerData.rows.reduce((s, r) => s + (r.debit || 0), 0),
            currencySymbol
          ),
        },
        {
          label: 'Total Credit Movements',
          value: formatMoney(
            ledgerData.rows.reduce((s, r) => s + (r.credit || 0), 0),
            currencySymbol
          ),
        },
        { label: 'Closing Net Balance', value: formatMoney(ledgerData.closingBalance, currencySymbol) },
      ],
    });
  };

  return (
    <div className="space-y-6">
      {/* Account Selector and Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          {/* Account Picker */}
          <div className="w-full sm:w-80">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Select Ledger Account
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md font-mono focus:ring-1 focus:ring-slate-400"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  [{a.code}] {a.name} ({a.type})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                From
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1.5 text-xs border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                To
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1.5 text-xs border border-slate-300 rounded-md"
              />
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={printLedger}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Ledger</span>
          </button>
        </div>
      </div>

      {/* Account Header Information Card */}
      {selectedAcc && (
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-extrabold text-slate-900">
                  [{selectedAcc.code}]
                </span>
                <h3 className="text-base font-bold text-slate-900">{selectedAcc.name}</h3>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-600 font-medium">{selectedAcc.category}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Classification: <span className="font-semibold text-slate-700">{selectedAcc.type}</span>
                {selectedAcc.isContra && <span className="ml-2 text-amber-700">(Contra Account)</span>}
              </p>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                  Opening Balance
                </span>
                <span className="font-mono tabular-nums text-sm font-semibold text-slate-700">
                  {formatMoney(ledgerData?.openingBalance || 0, currencySymbol)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                  Closing Net Balance
                </span>
                <span className="font-mono tabular-nums text-lg font-bold text-slate-900">
                  {formatMoney(ledgerData?.closingBalance || 0, currencySymbol)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Transactions Grid */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-left">
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Journal #</th>
                <th className="py-2.5 px-4">Ref / Source</th>
                <th className="py-2.5 px-4">Particulars &amp; Narration</th>
                <th className="py-2.5 px-4 text-right">Debit ({currencySymbol})</th>
                <th className="py-2.5 px-4 text-right">Credit ({currencySymbol})</th>
                <th className="py-2.5 px-4 text-right font-bold">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading ledger entries...
                  </td>
                </tr>
              ) : !ledgerData || ledgerData.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No transactions recorded for this account in the selected period.
                  </td>
                </tr>
              ) : (
                ledgerData.rows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-4 whitespace-nowrap text-slate-700 font-medium">{r.date}</td>
                    <td className="py-2.5 px-4 whitespace-nowrap font-mono font-bold text-slate-900">
                      {r.journalNumber}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {r.referenceNumber || r.sourceDocument}
                    </td>
                    <td className="py-2.5 px-4 text-slate-800 max-w-md">
                      <div className="truncate">{r.description}</div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900 font-medium">
                      {r.debit > 0 ? formatMoney(r.debit, currencySymbol) : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900 font-medium">
                      {r.credit > 0 ? formatMoney(r.credit, currencySymbol) : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                      {formatMoney(r.runningBalance, currencySymbol)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
