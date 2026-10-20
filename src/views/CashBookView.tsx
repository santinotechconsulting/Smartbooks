import React, { useState } from 'react';
import {
  Wallet,
  ArrowRightLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Printer,
  Search,
  Filter,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { Company, CashTransaction, Account } from '../types.ts';
import { formatMoney, downloadCSV } from '../utils/export.ts';

interface CashBookViewProps {
  company: Company | null;
  accounts: Account[];
  cashBookData: {
    bookType: string;
    cashAccount: Account;
    bankAccount: Account;
    openingCash: number;
    openingBank: number;
    closingCash: number;
    closingBank: number;
    transactions: CashTransaction[];
  } | null;
  onRefresh: () => void;
  onOpenPrintModal: (doc: any) => void;
  onRecordTransaction: (data: any) => Promise<void>;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const CashBookView: React.FC<CashBookViewProps> = ({
  company,
  accounts,
  cashBookData,
  onRefresh,
  onOpenPrintModal,
  onRecordTransaction,
  showToast,
}) => {
  const currencySymbol = company?.currencySymbol || '$';
  const [selectedFormat, setSelectedFormat] = useState<'DOUBLE_COLUMN' | 'SINGLE_COLUMN' | 'THREE_COLUMN' | 'PETTY_CASH'>('DOUBLE_COLUMN');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'CASH_RECEIPT' | 'CASH_PAYMENT' | 'CONTRA_TRANSFER' | 'PETTY_CASH'>('CASH_RECEIPT');

  // Form states
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formAmount, setFormAmount] = useState('');
  const [formDiscount, setFormDiscount] = useState('0.00');
  const [formAccount, setFormAccount] = useState('');
  const [formTargetAccount, setFormTargetAccount] = useState('');
  const [formPayee, setFormPayee] = useState('');
  const [formRef, setFormRef] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formMethod, setFormMethod] = useState('CASH');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cashAccounts = accounts.filter((a) => a.category === 'Cash & Bank');
  const defaultCashAcc = cashAccounts.find((a) => a.code === '1010') || cashAccounts[0];
  const defaultBankAcc = cashAccounts.find((a) => a.code === '1030') || cashAccounts[1] || defaultCashAcc;

  const revenueAccounts = accounts.filter((a) => a.type === 'INCOME');
  const expenseAccounts = accounts.filter((a) => a.type === 'EXPENSE');

  const openModal = (type: 'CASH_RECEIPT' | 'CASH_PAYMENT' | 'CONTRA_TRANSFER' | 'PETTY_CASH') => {
    setModalType(type);
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormAmount('');
    setFormDiscount('0.00');
    setFormPayee('');
    setFormRef('');
    setFormDesc('');
    setFormError('');

    if (type === 'CONTRA_TRANSFER') {
      setFormAccount(String(defaultBankAcc?.id || ''));
      setFormTargetAccount(String(defaultCashAcc?.id || ''));
      setFormPayee('Internal Office Cash Transfer');
      setFormDesc('Bank withdrawal for office cash float');
      setFormMethod('BANK_TRANSFER');
    } else if (type === 'CASH_RECEIPT') {
      setFormAccount(String(defaultCashAcc?.id || ''));
      setFormTargetAccount(String(revenueAccounts[0]?.id || ''));
      setFormMethod('CASH');
    } else {
      setFormAccount(String(defaultBankAcc?.id || ''));
      setFormTargetAccount(String(expenseAccounts[0]?.id || ''));
      setFormMethod('BANK_TRANSFER');
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formAmount || parseFloat(formAmount) <= 0) return;
    setIsSubmitting(true);
    try {
      await onRecordTransaction({
        companyId: company?.id,
        transactionType: modalType,
        bookType: selectedFormat,
        date: formDate,
        accountId: formAccount,
        targetAccountId: formTargetAccount,
        amount: formAmount,
        discountAmount: formDiscount,
        paymentMethod: formMethod,
        referenceNumber: formRef,
        payerPayee: formPayee,
        description: formDesc,
      });
      setShowModal(false);
      if (showToast) {
        showToast('Cash Book transaction successfully posted!', 'success');
      }
      onRefresh();
    } catch (err: any) {
      const msg = err.message || 'Failed to record entry';
      setFormError(msg);
      if (showToast) {
        showToast(msg, 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const txs = cashBookData?.transactions || [];
  const filteredTxs = txs.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.voucherNumber.toLowerCase().includes(q) ||
      t.payerPayee.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      (t.referenceNumber && t.referenceNumber.toLowerCase().includes(q))
    );
  });

  const exportCSV = () => {
    const headers = [
      'Date',
      'Voucher #',
      'Ref',
      'Particulars',
      'Type',
      'Cash Receipt',
      'Cash Payment',
      'Bank Receipt',
      'Bank Payment',
      'Running Cash',
      'Running Bank',
    ];
    const rows = filteredTxs.map((t) => [
      t.date,
      t.voucherNumber,
      t.referenceNumber || '',
      t.payerPayee,
      t.transactionType,
      t.cashReceipt || 0,
      t.cashPayment || 0,
      t.bankReceipt || 0,
      t.bankPayment || 0,
      t.runningCash || 0,
      t.runningBank || 0,
    ]);
    downloadCSV(`Cash_Book_${selectedFormat}_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  const printCashBook = () => {
    onOpenPrintModal({
      title: `${selectedFormat.replace('_', ' ')} Cash Book`,
      documentNumber: `CB-${new Date().getFullYear()}`,
      date: new Date().toISOString().slice(0, 10),
      description: `Complete running records for ${company?.name || 'Company'} cash and banking channels`,
      columns: [
        { header: 'Date', key: 'date' },
        { header: 'Voucher #', key: 'voucherNumber' },
        { header: 'Ref / Folio', key: 'referenceNumber' },
        { header: 'Particulars / Payee', key: 'payerPayee' },
        { header: 'Cash In', key: 'cashReceipt', align: 'right' },
        { header: 'Cash Out', key: 'cashPayment', align: 'right' },
        { header: 'Bank In', key: 'bankReceipt', align: 'right' },
        { header: 'Bank Out', key: 'bankPayment', align: 'right' },
        { header: 'Cash Bal', key: 'runningCash', align: 'right' },
        { header: 'Bank Bal', key: 'runningBank', align: 'right' },
      ],
      rows: filteredTxs.map((t) => ({
        ...t,
        cashReceipt: t.cashReceipt ? formatMoney(t.cashReceipt, currencySymbol) : '-',
        cashPayment: t.cashPayment ? formatMoney(t.cashPayment, currencySymbol) : '-',
        bankReceipt: t.bankReceipt ? formatMoney(t.bankReceipt, currencySymbol) : '-',
        bankPayment: t.bankPayment ? formatMoney(t.bankPayment, currencySymbol) : '-',
        runningCash: formatMoney(t.runningCash, currencySymbol),
        runningBank: formatMoney(t.runningBank, currencySymbol),
      })),
      totals: [
        { label: 'Closing Cash Balance', value: formatMoney(cashBookData?.closingCash || 0, currencySymbol) },
        { label: 'Closing Bank Balance', value: formatMoney(cashBookData?.closingBank || 0, currencySymbol) },
      ],
    });
  };

  const isCashNegative = (cashBookData?.closingCash ?? 0) < 0;

  return (
    <div className="space-y-6">
      {/* Format Selector & Summary Cards */}
      <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 items-stretch justify-between">
        {/* Cash Book Format Switcher Tabs */}
        <div className="bg-slate-100 p-1 rounded-lg border border-slate-200 flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full">
          {[
            { id: 'DOUBLE_COLUMN', full: 'Double-Column (Cash + Bank)', short: 'Double-Column' },
            { id: 'THREE_COLUMN', full: 'Three-Column (Discount)', short: 'Three-Column' },
            { id: 'SINGLE_COLUMN', full: 'Single-Column (Cash)', short: 'Single-Column' },
            { id: 'PETTY_CASH', full: 'Petty Cash Book', short: 'Petty Cash' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedFormat(tab.id as any)}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap min-h-[38px] ${
                selectedFormat === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="sm:hidden">{tab.short}</span>
              <span className="hidden sm:inline">{tab.full}</span>
            </button>
          ))}
        </div>

        {/* Running Balances */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-4 w-full sm:w-auto">
          <div className="bg-white border border-slate-200 rounded-lg p-2.5 sm:px-4 sm:py-2 text-right shadow-xs">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block truncate">
              Cash on Hand
            </span>
            <span
              className={`text-sm sm:text-base font-bold font-mono tabular-nums ${
                isCashNegative ? 'text-red-600' : 'text-slate-900'
              }`}
            >
              {formatMoney(cashBookData?.closingCash || 0, currencySymbol)}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-2.5 sm:px-4 sm:py-2 text-right shadow-xs">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block truncate">
              Bank Balance
            </span>
            <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-slate-900">
              {formatMoney(cashBookData?.closingBank || 0, currencySymbol)}
            </span>
          </div>
        </div>
      </div>

      {isCashNegative && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>
            <strong>Warning: Cash balance is negative ({formatMoney(cashBookData?.closingCash || 0, currencySymbol)}).</strong>{' '}
            Review recorded disbursements or record an opening cash balance/capital injection.
          </span>
        </div>
      )}

      {/* Action Bar */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search particulars, voucher, ref..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={() => openModal('CASH_RECEIPT')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>+ Cash Receipt</span>
          </button>

          <button
            onClick={() => openModal('CASH_PAYMENT')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition-colors"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+ Payment Voucher</span>
          </button>

          <button
            onClick={() => openModal('CONTRA_TRANSFER')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Contra Transfer (C)</span>
          </button>

          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <button
            onClick={printCashBook}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Book</span>
          </button>
        </div>
      </div>

      {/* Multi-Column Cash Book Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto financial-scroll">
          <table className="w-full text-xs min-w-[760px]">
            <thead>
              {/* Top grouping header for Double / Three Column */}
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold text-center">
                <th colSpan={4} className="py-2 px-3 border-r border-slate-200 text-left">
                  Transaction Details
                </th>
                <th colSpan={selectedFormat === 'THREE_COLUMN' ? 3 : 2} className="py-2 px-3 border-r border-slate-200 bg-emerald-50/60 text-emerald-900">
                  DEBIT / RECEIPTS (INWARDS)
                </th>
                <th colSpan={selectedFormat === 'THREE_COLUMN' ? 3 : 2} className="py-2 px-3 border-r border-slate-200 bg-amber-50/60 text-amber-900">
                  CREDIT / PAYMENTS (OUTWARDS)
                </th>
                <th colSpan={2} className="py-2 px-3 bg-slate-100 text-slate-900">
                  RUNNING BALANCES
                </th>
              </tr>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-left">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Voucher #</th>
                <th className="py-2.5 px-3">Ref / Folio</th>
                <th className="py-2.5 px-3">Particulars &amp; Narration</th>

                {/* Receipts */}
                <th className="py-2.5 px-3 text-right bg-emerald-50/30">Cash Rec</th>
                <th className="py-2.5 px-3 text-right bg-emerald-50/30">Bank Rec</th>
                {selectedFormat === 'THREE_COLUMN' && (
                  <th className="py-2.5 px-3 text-right bg-emerald-50/30">Discount</th>
                )}

                {/* Payments */}
                <th className="py-2.5 px-3 text-right bg-amber-50/30">Cash Pay</th>
                <th className="py-2.5 px-3 text-right bg-amber-50/30">Bank Pay</th>
                {selectedFormat === 'THREE_COLUMN' && (
                  <th className="py-2.5 px-3 text-right bg-amber-50/30">Discount</th>
                )}

                {/* Running */}
                <th className="py-2.5 px-3 text-right font-mono font-bold">Cash Balance</th>
                <th className="py-2.5 px-3 text-right font-mono font-bold">Bank Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTxs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    No cash book transactions found. Click "+ Cash Receipt" or "+ Payment Voucher" to add.
                  </td>
                </tr>
              ) : (
                filteredTxs.map((t) => {
                  const isContra = t.transactionType === 'CONTRA_TRANSFER';
                  return (
                    <tr
                      key={t.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isContra ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">{t.date}</td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {t.voucherNumber}
                        {isContra && (
                          <span className="ml-1 text-[9px] bg-blue-100 text-blue-800 px-1 py-0.2 rounded font-bold">
                            (C)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                        {t.referenceNumber || '-'}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">{t.payerPayee}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">{t.description}</div>
                      </td>

                      {/* Receipts */}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700 font-medium bg-emerald-50/20">
                        {t.cashReceipt ? formatMoney(t.cashReceipt, currencySymbol) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700 font-medium bg-emerald-50/20">
                        {t.bankReceipt ? formatMoney(t.bankReceipt, currencySymbol) : '-'}
                      </td>
                      {selectedFormat === 'THREE_COLUMN' && (
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500 bg-emerald-50/20">
                          {t.discount ? formatMoney(t.discount, currencySymbol) : '-'}
                        </td>
                      )}

                      {/* Payments */}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-700 font-medium bg-amber-50/20">
                        {t.cashPayment ? formatMoney(t.cashPayment, currencySymbol) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-700 font-medium bg-amber-50/20">
                        {t.bankPayment ? formatMoney(t.bankPayment, currencySymbol) : '-'}
                      </td>
                      {selectedFormat === 'THREE_COLUMN' && (
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500 bg-amber-50/20">
                          {t.discount ? formatMoney(t.discount, currencySymbol) : '-'}
                        </td>
                      )}

                      {/* Running */}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatMoney(t.runningCash, currencySymbol)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatMoney(t.runningBank, currencySymbol)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Modal (Receipt / Payment / Contra) */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold tracking-tight">
                  {modalType === 'CASH_RECEIPT' && 'Record Cash / Bank Receipt Voucher'}
                  {modalType === 'CASH_PAYMENT' && 'Record Payment Voucher'}
                  {modalType === 'CONTRA_TRANSFER' && 'Record Contra Transfer (Cash ⇄ Bank)'}
                  {modalType === 'PETTY_CASH' && 'Record Petty Cash Expense'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {modalType === 'CONTRA_TRANSFER'
                    ? 'Internal transfer between cash on hand and bank accounts'
                    : 'Automatically generates double-entry balanced journal entry'}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Transaction Date</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 sm:py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-400 text-xs sm:text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={formMethod}
                    onChange={(e) => setFormMethod(e.target.value)}
                    className="w-full px-3 py-2 sm:py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-slate-400 text-xs"
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Wire / Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CARD">Debit / Credit Card</option>
                  </select>
                </div>
              </div>

              {/* Source Account vs Target Account */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {modalType === 'CONTRA_TRANSFER' ? 'Transfer From (Credit)' : 'Cash/Bank Account'}
                  </label>
                  <select
                    required
                    value={formAccount}
                    onChange={(e) => setFormAccount(e.target.value)}
                    className="w-full px-3 py-2 sm:py-1.5 border border-slate-300 rounded-md font-mono text-[11px]"
                  >
                    {cashAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        [{a.code}] {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {modalType === 'CONTRA_TRANSFER'
                      ? 'Transfer To (Debit)'
                      : modalType === 'CASH_RECEIPT'
                      ? 'Credit Account (Income/AR)'
                      : 'Debit Account (Expense/AP)'}
                  </label>
                  <select
                    required
                    value={formTargetAccount}
                    onChange={(e) => setFormTargetAccount(e.target.value)}
                    className="w-full px-3 py-2 sm:py-1.5 border border-slate-300 rounded-md font-mono text-[11px]"
                  >
                    {modalType === 'CONTRA_TRANSFER' ? (
                      cashAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          [{a.code}] {a.name}
                        </option>
                      ))
                    ) : (
                      accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          [{a.code}] {a.name} ({a.category})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Amount ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    inputMode="decimal"
                    required
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full px-3 py-2 sm:py-1.5 border border-slate-300 rounded-md font-mono tabular-nums font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ref / Cheque #</label>
                  <input
                    type="text"
                    placeholder="e.g. CHK-1092, SLIP-44"
                    value={formRef}
                    onChange={(e) => setFormRef(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {modalType === 'CASH_RECEIPT' ? 'Received From (Customer/Payer)' : 'Paid To (Payee/Supplier)'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nexus Corp Solutions / Office Depot"
                  value={formPayee}
                  onChange={(e) => setFormPayee(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Narration / Description</label>
                <textarea
                  rows={2}
                  required
                  placeholder="State transaction purpose..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
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
                  {isSubmitting ? 'Posting Double Entry...' : 'Post Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
