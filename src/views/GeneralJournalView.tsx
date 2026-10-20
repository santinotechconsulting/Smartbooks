import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Eye,
} from 'lucide-react';
import { Company, JournalEntry, Account } from '../types.ts';
import { formatMoney, downloadCSV } from '../utils/export.ts';
import { ConfirmModal } from '../components/ConfirmModal.tsx';

interface GeneralJournalViewProps {
  company: Company | null;
  accounts: Account[];
  journals: JournalEntry[];
  onRefresh: () => void;
  onOpenPrintModal: (doc: any) => void;
  onPostJournal: (data: any) => Promise<void>;
  onReverseJournal: (id: number) => Promise<void>;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const GeneralJournalView: React.FC<GeneralJournalViewProps> = ({
  company,
  accounts,
  journals,
  onRefresh,
  onOpenPrintModal,
  onPostJournal,
  onReverseJournal,
  showToast,
}) => {
  const currencySymbol = company?.currencySymbol || '$';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [confirmReverseId, setConfirmReverseId] = useState<number | null>(null);

  // New Journal Entry Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formRef, setFormRef] = useState('');
  const [formSource, setFormSource] = useState('General Journal');
  const [formDesc, setFormDesc] = useState('');
  const [lines, setLines] = useState<
    { accountId: string; debit: string; credit: string; description: string }[]
  >([
    { accountId: String(accounts[0]?.id || ''), debit: '', credit: '', description: '' },
    { accountId: String(accounts[1]?.id || ''), debit: '', credit: '', description: '' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Live debit and credit balancing calculator
  const totalDebits = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredits = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const difference = Math.abs(totalDebits - totalCredits);
  const isBalanced = difference < 0.005 && totalDebits > 0;

  const handleAddLine = () => {
    setLines([...lines, { accountId: String(accounts[0]?.id || ''), debit: '', credit: '', description: '' }]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: string, val: string) => {
    const next = [...lines];
    (next[idx] as any)[field] = val;
    // Auto clear opposite side if entering debit or credit
    if (field === 'debit' && parseFloat(val) > 0) {
      next[idx].credit = '';
    } else if (field === 'credit' && parseFloat(val) > 0) {
      next[idx].debit = '';
    }
    setLines(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!isBalanced) {
      setErrorMsg(`Journal entry is out of balance by ${formatMoney(difference, currencySymbol)}. Debits must equal Credits.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onPostJournal({
        companyId: company?.id,
        date: formDate,
        accountingPeriod: formDate.slice(0, 7),
        referenceNumber: formRef,
        sourceDocument: formSource,
        description: formDesc,
        status: 'posted',
        lines: lines.filter((l) => (parseFloat(l.debit) || 0) > 0 || (parseFloat(l.credit) || 0) > 0),
      });
      setShowCreateModal(false);
      if (showToast) {
        showToast('Double-entry journal posted successfully!', 'success');
      }
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to post journal entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeReverse = async () => {
    if (!confirmReverseId) return;
    try {
      await onReverseJournal(confirmReverseId);
      setConfirmReverseId(null);
      setSelectedEntry(null);
      if (showToast) {
        showToast('Audit reversal journal posted and ledger updated!', 'success');
      }
      onRefresh();
    } catch (err: any) {
      const msg = err.message || 'Failed to reverse journal entry';
      if (showToast) {
        showToast(msg, 'error');
      }
    }
  };

  const filteredJournals = journals.filter((j) => {
    const matchesSearch =
      !searchQuery ||
      j.journalNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (j.referenceNumber && j.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      selectedStatus === 'ALL' ||
      (selectedStatus === 'POSTED' && !j.isReversed) ||
      (selectedStatus === 'REVERSED' && j.isReversed);

    return matchesSearch && matchesStatus;
  });

  const printVoucher = (entry: JournalEntry) => {
    onOpenPrintModal({
      title: 'General Journal Voucher',
      documentNumber: entry.journalNumber,
      date: entry.date,
      reference: entry.referenceNumber || 'N/A',
      description: entry.description,
      preparedBy: entry.createdBy,
      approvedBy: entry.approvedBy || 'Authorized Officer',
      columns: [
        { header: 'Account Code', key: 'code' },
        { header: 'Account Title', key: 'name' },
        { header: 'Line Narration', key: 'description' },
        { header: 'Debit', key: 'debit', align: 'right' },
        { header: 'Credit', key: 'credit', align: 'right' },
      ],
      rows: entry.lines.map((l) => ({
        code: l.account?.code || 'N/A',
        name: l.account?.name || 'Account',
        description: l.description || entry.description,
        debit: parseFloat(l.debit) > 0 ? formatMoney(l.debit, currencySymbol) : '-',
        credit: parseFloat(l.credit) > 0 ? formatMoney(l.credit, currencySymbol) : '-',
      })),
      totals: [
        {
          label: 'Total Debits',
          value: formatMoney(
            entry.lines.reduce((s, l) => s + parseFloat(l.debit || '0'), 0),
            currencySymbol
          ),
        },
        {
          label: 'Total Credits',
          value: formatMoney(
            entry.lines.reduce((s, l) => s + parseFloat(l.credit || '0'), 0),
            currencySymbol
          ),
        },
      ],
      notes: entry.isReversed ? 'WARNING: This journal entry has been reversed for audit purposes.' : undefined,
    });
  };

  const exportJournalsCSV = () => {
    const headers = ['Journal #', 'Date', 'Description', 'Account Code', 'Account Name', 'Debit', 'Credit', 'Status'];
    const rows: (string | number)[][] = [];
    for (const j of filteredJournals) {
      for (const l of j.lines) {
        rows.push([
          j.journalNumber,
          j.date,
          j.description,
          l.account?.code || '',
          l.account?.name || '',
          l.debit,
          l.credit,
          j.isReversed ? 'REVERSED' : 'POSTED',
        ]);
      }
    }
    downloadCSV(`General_Journal_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Action and Filter Strip */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search journal #, description, ref..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md border border-slate-200 text-xs">
            {['ALL', 'POSTED', 'REVERSED'].map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-2.5 py-1 font-medium rounded transition-colors ${
                  selectedStatus === st ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={exportJournalsCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ New Journal Entry</span>
          </button>
        </div>
      </div>

      {/* Main Journal Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto financial-scroll">
          <table className="w-full text-xs min-w-[680px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-left">
                <th className="py-2.5 px-4">Journal #</th>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Description &amp; Source</th>
                <th className="py-2.5 px-4">Ref / Document</th>
                <th className="py-2.5 px-4 text-right">Debit Total</th>
                <th className="py-2.5 px-4 text-right">Credit Total</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredJournals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No journal entries found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredJournals.map((j) => {
                  const debSum = j.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
                  const credSum = j.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
                  return (
                    <tr key={j.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {j.journalNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{j.date}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{j.description}</div>
                        <div className="text-[11px] text-slate-500">{j.sourceDocument} · {j.createdBy}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                        {j.referenceNumber || '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatMoney(debSum, currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatMoney(credSum, currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-center">
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
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedEntry(j)}
                            title="Inspect Journal Lines"
                            className="p-1 text-slate-500 hover:text-slate-900 rounded"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => printVoucher(j)}
                            title="Print Journal Voucher"
                            className="p-1 text-slate-500 hover:text-slate-900 rounded"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          {!j.isReversed && (
                            <button
                              onClick={() => handleReverse(j.id)}
                              title="Audit Reversal"
                              className="p-1 text-amber-600 hover:text-amber-800 rounded"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal for Selected Journal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold tracking-tight">Journal Entry {selectedEntry.journalNumber}</h3>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      selectedEntry.isReversed
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {selectedEntry.isReversed ? 'REVERSED' : 'POSTED'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{selectedEntry.description}</p>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-4 text-xs bg-slate-50 p-3 rounded-md border border-slate-200">
                <div>
                  <span className="text-slate-500 block">Posting Date:</span>
                  <span className="font-semibold text-slate-900">{selectedEntry.date}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Source Document:</span>
                  <span className="font-semibold text-slate-900">{selectedEntry.sourceDocument}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Reference Number:</span>
                  <span className="font-semibold text-slate-900 font-mono">{selectedEntry.referenceNumber || 'N/A'}</span>
                </div>
              </div>

              {/* Line Items */}
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-semibold text-left border-b border-slate-200">
                      <th className="py-2 px-3">Account</th>
                      <th className="py-2 px-3">Description</th>
                      <th className="py-2 px-3 text-right">Debit ({currencySymbol})</th>
                      <th className="py-2 px-3 text-right">Credit ({currencySymbol})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedEntry.lines.map((l, idx) => (
                      <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/50' : ''}>
                        <td className="py-2 px-3">
                          <span className="font-mono font-bold text-slate-900 mr-1.5">[{l.account?.code}]</span>
                          <span className="text-slate-800">{l.account?.name}</span>
                          <span className="text-[10px] text-slate-400 block">{l.account?.category}</span>
                        </td>
                        <td className="py-2 px-3 text-slate-600">{l.description || selectedEntry.description}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {parseFloat(l.debit) > 0 ? formatMoney(l.debit, currencySymbol) : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {parseFloat(l.credit) > 0 ? formatMoney(l.credit, currencySymbol) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-900 font-bold text-slate-900">
                      <td colSpan={2} className="py-2 px-3 text-right">Balanced Total:</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">
                        {formatMoney(
                          selectedEntry.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0),
                          currencySymbol
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">
                        {formatMoney(
                          selectedEntry.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0),
                          currencySymbol
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-500 pt-2">
                <div>
                  Created By: <span className="font-medium text-slate-700">{selectedEntry.createdBy}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => printVoucher(selectedEntry)}
                    className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded hover:bg-slate-50 font-medium"
                  >
                    Print Voucher
                  </button>
                  {!selectedEntry.isReversed && (
                    <button
                      onClick={() => setConfirmReverseId(selectedEntry.id)}
                      className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 font-semibold"
                    >
                      Audit Reversal
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Journal Entry Modal with Live Debit/Credit Calculator */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold tracking-tight">Post Double-Entry General Journal</h3>
                <p className="text-[11px] text-slate-400">
                  Enforces strict accounting equality: Total Debits must equal Total Credits
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Journal Date</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Reference / Document #</label>
                  <input
                    type="text"
                    placeholder="e.g. ADJ-001, MEMO-99"
                    value={formRef}
                    onChange={(e) => setFormRef(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Source Document</label>
                  <select
                    value={formSource}
                    onChange={(e) => setFormSource(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                  >
                    <option value="General Journal">General Journal</option>
                    <option value="Adjusting Entry">Adjusting Entry</option>
                    <option value="Accrual">Accrual</option>
                    <option value="Prepayment">Prepayment</option>
                    <option value="Depreciation">Depreciation</option>
                    <option value="Correction">Correction</option>
                    <option value="Year-End Closing">Year-End Closing</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Journal Narration / Description</label>
                <input
                  type="text"
                  required
                  placeholder="Explain transaction purpose and authorization..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-medium"
                />
              </div>

              {/* Dynamic Lines Table */}
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <div className="bg-slate-50 p-2.5 border-b border-slate-200 flex justify-between items-center">
                  <span className="font-bold text-slate-800">Account Allocation Lines</span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-[11px] font-semibold text-slate-900 bg-white border border-slate-300 px-2.5 py-1 rounded hover:bg-slate-100"
                  >
                    + Add Line
                  </button>
                </div>

                <div className="overflow-x-auto financial-scroll max-h-72">
                  <table className="w-full text-xs min-w-[580px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 text-left">
                        <th className="py-2 px-3 w-1/3">Account</th>
                        <th className="py-2 px-3">Description</th>
                        <th className="py-2 px-3 text-right w-28">Debit ({currencySymbol})</th>
                        <th className="py-2 px-3 text-right w-28">Credit ({currencySymbol})</th>
                        <th className="py-2 px-2 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lines.map((line, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3">
                            <select
                              required
                              value={line.accountId}
                              onChange={(e) => handleLineChange(idx, 'accountId', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono text-[11px]"
                            >
                              {accounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                  [{a.code}] {a.name} ({a.category})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              placeholder="Line narration..."
                              value={line.description}
                              onChange={(e) => handleLineChange(idx, 'description', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={line.debit}
                              onChange={(e) => handleLineChange(idx, 'debit', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-300 rounded text-right font-mono tabular-nums text-xs"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={line.credit}
                              onChange={(e) => handleLineChange(idx, 'credit', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-300 rounded text-right font-mono tabular-nums text-xs"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            {lines.length > 2 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(idx)}
                                className="text-slate-400 hover:text-red-600 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Live Balancing Footer */}
                <div className="bg-slate-100 p-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">Total Debits:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatMoney(totalDebits, currencySymbol)}
                      </span>
                    </div>
                    <span className="text-slate-300">·</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">Total Credits:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatMoney(totalCredits, currencySymbol)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isBalanced ? (
                      <span className="flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Balanced (Diff: $0.00)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-700 font-bold bg-red-50 border border-red-200 px-2.5 py-1 rounded">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Out of Balance: {formatMoney(difference, currencySymbol)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isBalanced || isSubmitting}
                  className={`px-4 py-2 rounded-md font-semibold text-white shadow-xs transition-colors ${
                    isBalanced && !isSubmitting
                      ? 'bg-slate-900 hover:bg-slate-800 cursor-pointer'
                      : 'bg-slate-400 cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? 'Posting Double Entry...' : 'Post Balanced Journal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Reversal Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmReverseId !== null}
        title="Confirm Double-Entry Reversal"
        message="Are you sure you want to reverse this posted journal entry? This will post an auditable contra-reversal journal with inverted debits and credits in accordance with double-entry accounting standards."
        confirmLabel="Reverse Entry"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={executeReverse}
        onCancel={() => setConfirmReverseId(null)}
      />
    </div>
  );
};
