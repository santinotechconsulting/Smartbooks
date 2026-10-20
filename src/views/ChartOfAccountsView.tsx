import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  ChevronRight,
  FolderTree,
} from 'lucide-react';
import { Company, Account } from '../types.ts';
import { formatMoney, downloadCSV } from '../utils/export.ts';

interface ChartOfAccountsViewProps {
  company: Company | null;
  accounts: Account[];
  onRefresh: () => void;
  onOpenPrintModal: (doc: any) => void;
  onCreateAccount: (data: any) => Promise<void>;
  onSelectAccountForLedger?: (id: number) => void;
}

export const ChartOfAccountsView: React.FC<ChartOfAccountsViewProps> = ({
  company,
  accounts,
  onRefresh,
  onOpenPrintModal,
  onCreateAccount,
  onSelectAccountForLedger,
}) => {
  const currencySymbol = company?.currencySymbol || '$';
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Add Account Modal
  const [showModal, setShowModal] = useState(false);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'>('ASSET');
  const [formCategory, setFormCategory] = useState('Current Assets');
  const [formIsContra, setFormIsContra] = useState(false);
  const [formDesc, setFormDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const typeTabs = [
    { id: 'ALL', label: 'All Accounts' },
    { id: 'ASSET', label: 'Assets (1000s)' },
    { id: 'LIABILITY', label: 'Liabilities (2000s)' },
    { id: 'EQUITY', label: 'Equity (3000s)' },
    { id: 'INCOME', label: 'Income / Revenue (4000s)' },
    { id: 'EXPENSE', label: 'Expenses (5000s)' },
  ];

  const categoriesByType: Record<string, string[]> = {
    ASSET: ['Cash & Bank', 'Accounts Receivable', 'Inventory', 'Current Assets', 'Fixed Assets'],
    LIABILITY: ['Accounts Payable', 'Current Liabilities', 'Long Term Liabilities'],
    EQUITY: ['Equity', 'Retained Earnings'],
    INCOME: ['Sales Revenue', 'Other Income'],
    EXPENSE: ['Cost of Goods Sold', 'Operating Expenses', 'Finance Costs', 'Tax'],
  };

  const handleTypeChange = (type: any) => {
    setFormType(type);
    setFormCategory(categoriesByType[type][0] || 'General');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      await onCreateAccount({
        companyId: company?.id,
        code: formCode,
        name: formName,
        type: formType,
        category: formCategory,
        isContra: formIsContra,
        description: formDesc,
        openingDebit: '0.00',
        openingCredit: '0.00',
      });
      setShowModal(false);
      setFormCode('');
      setFormName('');
      setFormDesc('');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredAccounts = accounts.filter((a) => {
    const matchesType = selectedType === 'ALL' || a.type === selectedType;
    const matchesSearch =
      !searchQuery ||
      a.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const exportCSV = () => {
    const headers = ['Code', 'Account Name', 'Type', 'Category', 'Period Debit', 'Period Credit', 'Net Balance'];
    const rows = filteredAccounts.map((a) => [
      a.code,
      a.name,
      a.type,
      a.category,
      a.periodDebit || 0,
      a.periodCredit || 0,
      a.balance || 0,
    ]);
    downloadCSV(`Chart_of_Accounts_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  const printCOA = () => {
    onOpenPrintModal({
      title: 'Official Chart of Accounts',
      documentNumber: `COA-${new Date().getFullYear()}`,
      date: new Date().toISOString().slice(0, 10),
      description: `Complete hierarchical chart of accounts for ${company?.name || 'Company'}`,
      columns: [
        { header: 'Code', key: 'code' },
        { header: 'Account Title', key: 'name' },
        { header: 'Class', key: 'type' },
        { header: 'Reporting Group', key: 'category' },
        { header: 'Period Debit', key: 'periodDebit', align: 'right' },
        { header: 'Period Credit', key: 'periodCredit', align: 'right' },
        { header: 'Net Balance', key: 'balance', align: 'right' },
      ],
      rows: filteredAccounts.map((a) => ({
        ...a,
        periodDebit: formatMoney(a.periodDebit || 0, currencySymbol),
        periodCredit: formatMoney(a.periodCredit || 0, currencySymbol),
        balance: formatMoney(a.balance || 0, currencySymbol),
      })),
      totals: [
        {
          label: 'Total Accounts Listed',
          value: filteredAccounts.length,
        },
      ],
    });
  };

  return (
    <div className="space-y-6">
      {/* Category Tabs */}
      <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
        {typeTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedType(tab.id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              selectedType === tab.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Action Strip */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search code, account name, category..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={printCOA}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print COA</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Account</span>
          </button>
        </div>
      </div>

      {/* Chart of Accounts Grid */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-left">
                <th className="py-2.5 px-4 w-28">Code</th>
                <th className="py-2.5 px-4">Account Title &amp; Description</th>
                <th className="py-2.5 px-4">Classification</th>
                <th className="py-2.5 px-4">Reporting Group</th>
                <th className="py-2.5 px-4 text-right">Period Debits</th>
                <th className="py-2.5 px-4 text-right">Period Credits</th>
                <th className="py-2.5 px-4 text-right font-bold">Calculated Balance</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAccounts.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{a.code}</td>
                  <td className="py-2.5 px-4">
                    <div className="font-semibold text-slate-800">
                      {a.name}
                      {a.isContra && (
                        <span className="ml-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-normal">
                          Contra
                        </span>
                      )}
                    </div>
                    {a.description && (
                      <div className="text-[11px] text-slate-400 truncate max-w-sm">{a.description}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="text-[11px] font-medium text-slate-700">{a.type}</span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-600">{a.category}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                    {a.periodDebit ? formatMoney(a.periodDebit, currencySymbol) : '-'}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                    {a.periodCredit ? formatMoney(a.periodCredit, currencySymbol) : '-'}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                    {formatMoney(a.balance ?? 0, currencySymbol)}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    {onSelectAccountForLedger && (
                      <button
                        onClick={() => onSelectAccountForLedger(a.id)}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
                      >
                        Ledger →
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Account */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold tracking-tight">Create Ledger Account</h3>
                <p className="text-[11px] text-slate-400">Add an account to the company Chart of Accounts</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-4 text-xs">
              {errorMsg && (
                <div className="p-2.5 bg-red-50 text-red-700 rounded border border-red-200">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Account Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1050, 5025"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Account Classification</label>
                  <select
                    value={formType}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded font-medium"
                  >
                    <option value="ASSET">ASSET</option>
                    <option value="LIABILITY">LIABILITY</option>
                    <option value="EQUITY">EQUITY</option>
                    <option value="INCOME">INCOME</option>
                    <option value="EXPENSE">EXPENSE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Petty Cash Vault, Legal Fees"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reporting Group / Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded"
                >
                  {(categoriesByType[formType] || ['General']).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="contraCheck"
                  checked={formIsContra}
                  onChange={(e) => setFormIsContra(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                />
                <label htmlFor="contraCheck" className="text-slate-700 font-medium">
                  Is Contra Account (e.g. Accumulated Depreciation, Sales Returns)
                </label>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Usage Notes</label>
                <textarea
                  rows={2}
                  placeholder="Account accounting purpose..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 font-semibold shadow-xs"
                >
                  {isSubmitting ? 'Saving...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
