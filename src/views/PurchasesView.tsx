import React, { useState } from 'react';
import {
  ShoppingCart,
  Plus,
  Search,
  Download,
  Printer,
  CreditCard,
  UserPlus,
  Trash2,
} from 'lucide-react';
import { Company, Bill, Supplier, Product, Account } from '../types.ts';
import { formatMoney, downloadCSV } from '../utils/export.ts';

interface PurchasesViewProps {
  company: Company | null;
  bills: Bill[];
  suppliers: Supplier[];
  products: Product[];
  accounts: Account[];
  onRefresh: () => void;
  onOpenPrintModal: (doc: any) => void;
  onCreateBill: (data: any) => Promise<void>;
  onCreateSupplier: (data: any) => Promise<void>;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  company,
  bills,
  suppliers,
  products,
  accounts,
  onRefresh,
  onOpenPrintModal,
  onCreateBill,
  onCreateSupplier,
  showToast,
}) => {
  const currencySymbol = company?.currencySymbol || '$';
  const [tab, setTab] = useState<'BILLS' | 'SUPPLIERS'>('BILLS');
  const [searchQuery, setSearchQuery] = useState('');

  // Bill Modal
  const [showBillModal, setShowBillModal] = useState(false);
  const [billSupplierId, setBillSupplierId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [billDueDate, setBillDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  );
  const [billType, setBillType] = useState('CREDIT_PURCHASE');
  const [billNotes, setBillNotes] = useState('');
  const [items, setItems] = useState<
    { productId: string; expenseAccountId: string; description: string; quantity: string; unitCost: string; taxRate: string }[]
  >([
    {
      productId: '',
      expenseAccountId: String(accounts.find((a) => a.code === '5050')?.id || accounts[0]?.id || ''),
      description: 'Office Operating Supplies & Subscriptions',
      quantity: '1',
      unitCost: '250.00',
      taxRate: '0.00',
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Supplier Modal
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [suppName, setSuppName] = useState('');
  const [suppEmail, setSuppEmail] = useState('');
  const [suppPhone, setSuppPhone] = useState('');
  const [suppAddress, setSuppAddress] = useState('');
  const [suppTax, setSuppTax] = useState('');

  const expenseAccounts = accounts.filter((a) => a.type === 'EXPENSE');

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        productId: '',
        expenseAccountId: String(expenseAccounts[0]?.id || ''),
        description: '',
        quantity: '1',
        unitCost: '0.00',
        taxRate: '0.00',
      },
    ]);
  };

  const handleRemoveItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: string, val: string) => {
    const next = [...items];
    (next[idx] as any)[field] = val;
    setItems(next);
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billSupplierId || !billNumber) {
      if (showToast) showToast('Supplier and Bill Number are required.', 'info');
      return;
    }
    setIsSubmitting(true);
    try {
      await onCreateBill({
        companyId: company?.id,
        supplierId: billSupplierId,
        billNumber,
        date: billDate,
        dueDate: billDueDate,
        type: billType,
        notes: billNotes,
        items,
      });
      setShowBillModal(false);
      if (showToast) showToast(`Purchase bill #${billNumber} recorded and accounts payable updated!`, 'success');
      onRefresh();
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Failed to record bill', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onCreateSupplier({
        companyId: company?.id,
        name: suppName,
        email: suppEmail,
        phone: suppPhone,
        address: suppAddress,
        taxNumber: suppTax,
      });
      setShowSupplierModal(false);
      setSuppName('');
      setSuppEmail('');
      setSuppPhone('');
      setSuppAddress('');
      setSuppTax('');
      if (showToast) showToast(`Supplier profile "${suppName}" registered!`, 'success');
      onRefresh();
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Failed to register supplier', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const printBill = (b: Bill) => {
    onOpenPrintModal({
      title: 'Supplier Purchase Voucher',
      documentNumber: b.billNumber,
      date: b.date,
      dueDate: b.dueDate,
      recipientName: b.supplier?.name || 'Supplier',
      recipientAddress: b.supplier?.address || 'Address on file',
      recipientTaxId: b.supplier?.taxNumber || 'N/A',
      columns: [
        { header: 'Description / Item', key: 'description' },
        { header: 'Qty', key: 'quantity', align: 'center' },
        { header: 'Unit Cost', key: 'unitCost', align: 'right' },
        { header: 'Line Total', key: 'total', align: 'right' },
      ],
      rows: (b.items || []).map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unitCost: formatMoney(it.unitCost, currencySymbol),
        total: formatMoney(it.total, currencySymbol),
      })),
      totals: [
        { label: 'Subtotal', value: formatMoney(b.subtotal, currencySymbol) },
        { label: 'Tax', value: formatMoney(b.taxAmount, currencySymbol) },
        { label: 'Total Payable', value: formatMoney(b.totalAmount, currencySymbol) },
        { label: 'Amount Settled', value: formatMoney(b.amountPaid, currencySymbol) },
      ],
      notes: b.notes || 'Accounts Payable certified voucher.',
    });
  };

  const exportBillsCSV = () => {
    const headers = ['Bill #', 'Supplier', 'Date', 'Due Date', 'Status', 'Total', 'Paid'];
    const rows = bills.map((b) => [
      b.billNumber,
      b.supplier?.name || '',
      b.date,
      b.dueDate,
      b.status,
      b.totalAmount,
      b.amountPaid,
    ]);
    downloadCSV(`Supplier_Bills_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 self-start w-fit">
        <button
          onClick={() => setTab('BILLS')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            tab === 'BILLS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Purchase Bills ({bills.length})
        </button>
        <button
          onClick={() => setTab('SUPPLIERS')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            tab === 'SUPPLIERS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Supplier Directory ({suppliers.length})
        </button>
      </div>

      {/* Action Strip */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={tab === 'BILLS' ? 'Search bill #, supplier...' : 'Search supplier name...'}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {tab === 'BILLS' ? (
            <>
              <button
                onClick={exportBillsCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={() => {
                  setBillSupplierId(suppliers[0] ? String(suppliers[0].id) : '');
                  setBillNumber(`BILL-2026-${String(bills.length + 1).padStart(3, '0')}`);
                  setShowBillModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Record Purchase Bill</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowSupplierModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Register Supplier</span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {tab === 'BILLS' ? (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto financial-scroll">
            <table className="w-full text-xs min-w-[680px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-left">
                  <th className="py-2.5 px-4">Bill #</th>
                  <th className="py-2.5 px-4">Supplier</th>
                  <th className="py-2.5 px-4">Bill Date</th>
                  <th className="py-2.5 px-4">Due Date</th>
                  <th className="py-2.5 px-4 text-right">Total Amount</th>
                  <th className="py-2.5 px-4 text-right">Amount Paid</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bills.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{b.billNumber}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">{b.supplier?.name || 'Supplier'}</td>
                    <td className="py-2.5 px-4 text-slate-600">{b.date}</td>
                    <td className="py-2.5 px-4 text-slate-600">{b.dueDate}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                      {formatMoney(b.totalAmount, currencySymbol)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700">
                      {formatMoney(b.amountPaid, currencySymbol)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        {b.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => printBill(b)}
                        title="Print Voucher"
                        className="p-1 text-slate-500 hover:text-slate-900"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto financial-scroll">
            <table className="w-full text-xs min-w-[640px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-left">
                  <th className="py-2.5 px-4">Supplier Name</th>
                  <th className="py-2.5 px-4">Contact</th>
                  <th className="py-2.5 px-4">Address</th>
                  <th className="py-2.5 px-4">Tax ID</th>
                  <th className="py-2.5 px-4 text-right">Current Payable Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-4 font-bold text-slate-900">{s.name}</td>
                    <td className="py-2.5 px-4 text-slate-600">
                      <div>{s.email || '-'}</div>
                      <div className="text-[11px] text-slate-400">{s.phone || '-'}</div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{s.address || '-'}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">{s.taxNumber || '-'}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                      {formatMoney(s.currentBalance, currencySymbol)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Bill Modal */}
      {showBillModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold tracking-tight">Record Supplier Bill</h3>
                <p className="text-[11px] text-slate-400">
                  Debit Relevant Expense / Inventory, Credit Accounts Payable
                </p>
              </div>
              <button
                onClick={() => setShowBillModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateBill} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Supplier</label>
                  <select
                    required
                    value={billSupplierId}
                    onChange={(e) => setBillSupplierId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Supplier Bill #</label>
                  <input
                    type="text"
                    required
                    value={billNumber}
                    onChange={(e) => setBillNumber(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bill Date</label>
                  <input
                    type="date"
                    required
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded"
                  />
                </div>
              </div>

              {/* Items */}
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <div className="bg-slate-50 p-2.5 border-b border-slate-200 flex justify-between items-center">
                  <span className="font-bold text-slate-800">Purchased Items &amp; Expenses</span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-[11px] font-semibold text-slate-900 bg-white border border-slate-300 px-2.5 py-1 rounded hover:bg-slate-100"
                  >
                    + Add Item
                  </button>
                </div>

                <div className="p-2 space-y-2">
                  {items.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50/50 p-2 rounded border border-slate-200">
                      <div className="col-span-5">
                        <input
                          type="text"
                          required
                          placeholder="Item or expense description..."
                          value={it.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          step="1"
                          min="1"
                          inputMode="numeric"
                          required
                          placeholder="Qty"
                          value={it.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded text-center text-xs"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          inputMode="decimal"
                          required
                          placeholder="Unit Cost"
                          value={it.unitCost}
                          onChange={(e) => handleItemChange(idx, 'unitCost', e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded text-right font-mono text-xs"
                        />
                      </div>
                      <div className="col-span-2 text-right">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-slate-400 hover:text-red-600 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBillModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 font-semibold shadow-xs"
                >
                  {isSubmitting ? 'Posting...' : 'Record Bill & Post AP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Supplier Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold tracking-tight">Register Supplier / Vendor</h3>
                <p className="text-[11px] text-slate-400">Add vendor to accounts payable master records</p>
              </div>
              <button
                onClick={() => setShowSupplierModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateSupplierSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Supplier Company Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Global Tech Distributors"
                  value={suppName}
                  onChange={(e) => setSuppName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="orders@vendor.com"
                    value={suppEmail}
                    onChange={(e) => setSuppEmail(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="+1 555..."
                    value={suppPhone}
                    onChange={(e) => setSuppPhone(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  placeholder="Street, City, State"
                  value={suppAddress}
                  onChange={(e) => setSuppAddress(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tax ID / Vendor VAT</label>
                <input
                  type="text"
                  placeholder="US-TAX-..."
                  value={suppTax}
                  onChange={(e) => setSuppTax(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 font-semibold shadow-xs"
                >
                  {isSubmitting ? 'Saving...' : 'Register Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
