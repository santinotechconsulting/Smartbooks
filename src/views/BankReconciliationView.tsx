import React, { useState } from 'react';
import { Landmark, Plus, CheckCircle2, AlertCircle, Printer, Download } from 'lucide-react';
import { Company, Account, BankReconciliation } from '../types.ts';
import { formatMoney } from '../utils/export.ts';

interface BankReconciliationViewProps {
  company: Company | null;
  accounts: Account[];
  reconciliations: BankReconciliation[];
  onRefresh: () => void;
  onOpenPrintModal: (doc: any) => void;
  onSaveReconciliation: (data: any) => Promise<void>;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const BankReconciliationView: React.FC<BankReconciliationViewProps> = ({
  company,
  accounts,
  reconciliations,
  onRefresh,
  onOpenPrintModal,
  onSaveReconciliation,
  showToast,
}) => {
  const currencySymbol = company?.currencySymbol || '$';
  const bankAccounts = accounts.filter(
    (a) => a.category === 'Cash & Bank' && a.code !== '1010' && a.code !== '1020'
  );

  const [selectedAccountId, setSelectedAccountId] = useState(
    bankAccounts[0] ? String(bankAccounts[0].id) : ''
  );
  const [statementDate, setStatementDate] = useState(new Date().toISOString().slice(0, 10));
  const [statementEndBalance, setStatementEndBalance] = useState('');
  const [depositsInTransit, setDepositsInTransit] = useState('0.00');
  const [outstandingCheques, setOutstandingCheques] = useState('0.00');
  const [bankCharges, setBankCharges] = useState('0.00');
  const [bankInterest, setBankInterest] = useState('0.00');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedBank = bankAccounts.find((a) => String(a.id) === selectedAccountId) || bankAccounts[0];
  const bookBalance = selectedBank?.balance || 0;

  const stmtEnd = parseFloat(statementEndBalance) || 0;
  const depTransit = parseFloat(depositsInTransit) || 0;
  const outCheques = parseFloat(outstandingCheques) || 0;
  const charges = parseFloat(bankCharges) || 0;
  const interest = parseFloat(bankInterest) || 0;

  const adjustedBank = stmtEnd + depTransit - outCheques;
  const adjustedBook = bookBalance + interest - charges;
  const diff = Math.round((adjustedBank - adjustedBook + Number.EPSILON) * 100) / 100;
  const isReconciled = Math.abs(diff) < 0.01 && stmtEnd !== 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statementEndBalance) return;
    setIsSubmitting(true);
    try {
      await onSaveReconciliation({
        companyId: company?.id,
        accountId: selectedBank.id,
        statementDate,
        statementEndingBalance: statementEndBalance,
        depositsInTransit,
        outstandingCheques,
        bankCharges,
        bankInterest,
      });
      if (showToast) showToast('Bank reconciliation statement saved successfully!', 'success');
      onRefresh();
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Failed to save reconciliation', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const printStatement = () => {
    onOpenPrintModal({
      title: `Bank Reconciliation Statement: ${selectedBank?.name}`,
      documentNumber: `REC-STMT-${statementDate.replace(/-/g, '')}`,
      date: statementDate,
      description: `Reconciliation of bank statement with general cash book records`,
      columns: [
        { header: 'Reconciliation Line', key: 'label' },
        { header: 'Calculation Details', key: 'notes' },
        { header: 'Amount', key: 'amount', align: 'right' },
      ],
      rows: [
        { label: 'Bank Statement Ending Balance', notes: 'Per uploaded physical/CSV bank statement', amount: formatMoney(stmtEnd, currencySymbol) },
        { label: 'Add: Deposits in Transit', notes: 'Uncleared customer receipts', amount: formatMoney(depTransit, currencySymbol) },
        { label: 'Less: Outstanding Cheques / Payments', notes: 'Unpresented supplier disbursements', amount: `(${formatMoney(outCheques, currencySymbol)})` },
        { label: 'Adjusted Bank Balance', notes: 'Verified bank position', amount: formatMoney(adjustedBank, currencySymbol) },
        { label: 'General Ledger Cash Book Balance', notes: 'Book balance from ledger', amount: formatMoney(bookBalance, currencySymbol) },
        { label: 'Add: Bank Interest Earned', notes: 'Unrecorded interest revenue', amount: formatMoney(interest, currencySymbol) },
        { label: 'Less: Bank Service Charges', notes: 'Unrecorded maintenance fees', amount: `(${formatMoney(charges, currencySymbol)})` },
        { label: 'Adjusted Book Balance', notes: 'Verified book position', amount: formatMoney(adjustedBook, currencySymbol) },
      ],
      totals: [
        { label: 'Adjusted Bank Balance', value: formatMoney(adjustedBank, currencySymbol) },
        { label: 'Adjusted Book Balance', value: formatMoney(adjustedBook, currencySymbol) },
        { label: 'Reconciliation Variance', value: formatMoney(diff, currencySymbol) },
      ],
      notes: isReconciled
        ? 'Reconciliation Difference is $0.00. The bank balance is fully reconciled.'
        : 'Discrepancy pending adjustment.',
    });
  };

  return (
    <div className="space-y-6">
      {/* Account Picker */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-80">
          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Bank Account to Reconcile
          </label>
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded font-mono"
          >
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                [{b.code}] {b.name} ({formatMoney(b.balance || 0, currencySymbol)})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={printStatement}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Reconciliation Statement</span>
          </button>
        </div>
      </div>

      {/* Two-Pane Reconciliation Workspace */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
        {/* LEFT: Bank Statement Adjustments */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">1. Bank Statement Adjustments</h3>
            <span className="text-slate-400 font-mono">Statement Side</span>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Statement Date</label>
            <input
              type="date"
              required
              value={statementDate}
              onChange={(e) => setStatementDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Bank Statement Ending Balance ({currencySymbol})
            </label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="0.00"
              value={statementEndBalance}
              onChange={(e) => setStatementEndBalance(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono font-bold text-sm"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              (+) Deposits in Transit / Uncleared Inflows ({currencySymbol})
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={depositsInTransit}
              onChange={(e) => setDepositsInTransit(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Cash book receipts deposited but not yet credited by bank
            </span>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              (-) Outstanding Cheques / Unpresented Payments ({currencySymbol})
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={outstandingCheques}
              onChange={(e) => setOutstandingCheques(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Disbursements issued in cash book not yet cleared at bank
            </span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded flex justify-between items-center font-bold text-slate-900 mt-4">
            <span>Adjusted Bank Statement Balance:</span>
            <span className="font-mono tabular-nums text-sm font-extrabold">
              {formatMoney(adjustedBank, currencySymbol)}
            </span>
          </div>
        </div>

        {/* RIGHT: Cash Book Adjustments */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">2. General Ledger Cash Book</h3>
              <span className="text-slate-400 font-mono">Book Side</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <span className="text-slate-500 block text-[11px]">Current Cash Book Bank Balance:</span>
              <span className="font-mono text-base font-extrabold text-slate-900 block mt-0.5">
                {formatMoney(bookBalance, currencySymbol)}
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                (+) Bank Interest Earned ({currencySymbol})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={bankInterest}
                onChange={(e) => setBankInterest(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                (-) Bank Service Charges &amp; Fees ({currencySymbol})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={bankCharges}
                onChange={(e) => setBankCharges(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono"
              />
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded flex justify-between items-center font-bold text-slate-900">
              <span>Adjusted Book Balance:</span>
              <span className="font-mono tabular-nums text-sm font-extrabold">
                {formatMoney(adjustedBook, currencySymbol)}
              </span>
            </div>
          </div>

          {/* Variance Status and Save Button */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div
              className={`p-3 rounded border flex items-center justify-between ${
                isReconciled
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {isReconciled ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span className="font-bold">
                  {isReconciled ? 'Reconciled (Zero Difference)' : 'Reconciliation Difference:'}
                </span>
              </div>
              <span className="font-mono font-extrabold text-sm">
                {formatMoney(diff, currencySymbol)}
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !statementEndBalance}
              className="w-full py-2 bg-slate-900 text-white rounded font-semibold hover:bg-slate-800 transition-colors shadow-xs"
            >
              {isSubmitting ? 'Saving...' : 'Save Reconciliation Statement'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
