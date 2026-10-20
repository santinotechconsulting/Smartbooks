import React, { useState } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  CreditCard,
  UserPlus,
  Eye,
  Trash2,
} from 'lucide-react';
import { Company, Invoice, Customer, Product, Account } from '../types.ts';
import { formatMoney, downloadCSV } from '../utils/export.ts';

interface InvoicingViewProps {
  company: Company | null;
  invoices: Invoice[];
  customers: Customer[];
  products: Product[];
  accounts: Account[];
  onRefresh: () => void;
  onOpenPrintModal: (doc: any) => void;
  onCreateInvoice: (data: any) => Promise<void>;
  onRecordPayment: (invoiceId: number, data: any) => Promise<void>;
  onCreateCustomer: (data: any) => Promise<void>;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const InvoicingView: React.FC<InvoicingViewProps> = ({
  company,
  invoices,
  customers,
  products,
  accounts,
  onRefresh,
  onOpenPrintModal,
  onCreateInvoice,
  onRecordPayment,
  onCreateCustomer,
  showToast,
}) => {
  const currencySymbol = company?.currencySymbol || '$';
  const [tab, setTab] = useState<'INVOICES' | 'CUSTOMERS'>('INVOICES');
  const [searchQuery, setSearchQuery] = useState('');

  // New Invoice Modal
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invCustomerId, setInvCustomerId] = useState('');
  const [invDate, setInvDate] = useState(new Date().toISOString().slice(0, 10));
  const [invDueDate, setInvDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  );
  const [invType, setInvType] = useState('CREDIT_SALE');
  const [invTerms, setInvTerms] = useState('Net 30');
  const [invNotes, setInvNotes] = useState('Payment is due within 30 days.');
  const [items, setItems] = useState<
    { productId: string; description: string; quantity: string; unitPrice: string; taxRate: string }[]
  >([
    {
      productId: products[0] ? String(products[0].id) : '',
      description: products[0]?.name || 'Professional Services',
      quantity: '1',
      unitPrice: products[0]?.sellingPrice || '100.00',
      taxRate: '15.00',
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Payment Modal
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));

  // Customer Modal
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [custName, setCustName] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custTax, setCustTax] = useState('');
  const [custCreditLimit, setCustCreditLimit] = useState('10000');

  const cashAccounts = accounts.filter((a) => a.category === 'Cash & Bank');

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        productId: '',
        description: '',
        quantity: '1',
        unitPrice: '0.00',
        taxRate: '15.00',
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
    if (field === 'productId') {
      const prod = products.find((p) => String(p.id) === val);
      if (prod) {
        next[idx].description = prod.name;
        next[idx].unitPrice = prod.sellingPrice;
      }
    }
    setItems(next);
  };

  // Calculate invoice live totals
  let subtotal = 0;
  let taxTotal = 0;
  for (const it of items) {
    const q = parseFloat(it.quantity) || 0;
    const p = parseFloat(it.unitPrice) || 0;
    const rate = parseFloat(it.taxRate) || 0;
    const lineSub = q * p;
    subtotal += lineSub;
    taxTotal += (lineSub * rate) / 100;
  }
  const invoiceTotal = subtotal + taxTotal;

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invCustomerId) {
      if (showToast) showToast('Please select or register a customer first.', 'info');
      return;
    }
    setIsSubmitting(true);
    try {
      await onCreateInvoice({
        companyId: company?.id,
        customerId: invCustomerId,
        date: invDate,
        dueDate: invDueDate,
        type: invType,
        paymentTerms: invTerms,
        notes: invNotes,
        items,
        autoPost: true,
      });
      setShowInvoiceModal(false);
      if (showToast) showToast('Sales invoice created and ledger posted!', 'success');
      onRefresh();
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Failed to create invoice', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onCreateCustomer({
        companyId: company?.id,
        name: custName,
        email: custEmail,
        phone: custPhone,
        address: custAddress,
        taxNumber: custTax,
        creditLimit: custCreditLimit,
      });
      setShowCustomerModal(false);
      setCustName('');
      setCustEmail('');
      setCustPhone('');
      setCustAddress('');
      setCustTax('');
      if (showToast) showToast(`Customer account "${custName}" created!`, 'success');
      onRefresh();
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Failed to register customer', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice) return;
    setIsSubmitting(true);
    try {
      await onRecordPayment(payingInvoice.id, {
        amount: paymentAmount,
        paymentMethod,
        date: paymentDate,
        bankAccountId: cashAccounts[0]?.id,
      });
      setPayingInvoice(null);
      setPaymentAmount('');
      if (showToast) showToast('Customer payment received and receipt voucher recorded!', 'success');
      onRefresh();
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Failed to record customer payment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const printInvoice = (inv: Invoice) => {
    onOpenPrintModal({
      title: 'Tax Invoice',
      documentNumber: inv.invoiceNumber,
      date: inv.date,
      dueDate: inv.dueDate,
      recipientName: inv.customer?.name || 'Customer',
      recipientAddress: inv.customer?.address || 'Address on file',
      recipientTaxId: inv.customer?.taxNumber || 'N/A',
      columns: [
        { header: 'Description', key: 'description' },
        { header: 'Qty', key: 'quantity', align: 'center' },
        { header: 'Unit Price', key: 'unitPrice', align: 'right' },
        { header: 'Tax %', key: 'taxRate', align: 'center' },
        { header: 'Line Total', key: 'total', align: 'right' },
      ],
      rows: (inv.items || []).map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unitPrice: formatMoney(it.unitPrice, currencySymbol),
        taxRate: `${it.taxRate}%`,
        total: formatMoney(it.total, currencySymbol),
      })),
      totals: [
        { label: 'Subtotal (Net)', value: formatMoney(inv.subtotal, currencySymbol) },
        { label: 'VAT / Tax Total', value: formatMoney(inv.taxAmount, currencySymbol) },
        { label: 'Invoice Total', value: formatMoney(inv.totalAmount, currencySymbol) },
        { label: 'Amount Paid', value: formatMoney(inv.amountPaid, currencySymbol) },
        {
          label: 'Outstanding Balance',
          value: formatMoney(parseFloat(inv.totalAmount) - parseFloat(inv.amountPaid), currencySymbol),
        },
      ],
      notes: inv.notes || `Payment Terms: ${inv.paymentTerms}`,
    });
  };

  const exportInvoicesCSV = () => {
    const headers = ['Invoice #', 'Customer', 'Date', 'Due Date', 'Status', 'Total', 'Paid', 'Outstanding'];
    const rows = invoices.map((inv) => [
      inv.invoiceNumber,
      inv.customer?.name || '',
      inv.date,
      inv.dueDate,
      inv.status,
      inv.totalAmount,
      inv.amountPaid,
      parseFloat(inv.totalAmount) - parseFloat(inv.amountPaid),
    ]);
    downloadCSV(`Sales_Invoices_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 self-start w-fit">
        <button
          onClick={() => setTab('INVOICES')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            tab === 'INVOICES' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Sales Invoices ({invoices.length})
        </button>
        <button
          onClick={() => setTab('CUSTOMERS')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            tab === 'CUSTOMERS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Customer Directory ({customers.length})
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
            placeholder={tab === 'INVOICES' ? 'Search invoice #, customer...' : 'Search customer name, tax ID...'}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {tab === 'INVOICES' ? (
            <>
              <button
                onClick={exportInvoicesCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={() => {
                  setInvCustomerId(customers[0] ? String(customers[0].id) : '');
                  setShowInvoiceModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Create Invoice</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowCustomerModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Register Customer</span>
            </button>
          )}
        </div>
      </div>

      {/* View Content: Invoices Table */}
      {tab === 'INVOICES' ? (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto financial-scroll">
            <table className="w-full text-xs min-w-[720px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-left">
                  <th className="py-2.5 px-4">Invoice #</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Due Date</th>
                  <th className="py-2.5 px-4 text-right">Total Amount</th>
                  <th className="py-2.5 px-4 text-right">Amount Paid</th>
                  <th className="py-2.5 px-4 text-right">Outstanding</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No invoices created yet. Click "+ Create Invoice" to generate a bill.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const outstanding = parseFloat(inv.totalAmount) - parseFloat(inv.amountPaid);
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-800">
                          {inv.customer?.name || 'Customer'}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">{inv.date}</td>
                        <td className="py-2.5 px-4 text-slate-600">{inv.dueDate}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                          {formatMoney(inv.totalAmount, currencySymbol)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700">
                          {formatMoney(inv.amountPaid, currencySymbol)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                          {formatMoney(outstanding, currencySymbol)}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                              inv.status === 'paid'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : inv.status === 'partially_paid'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {inv.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => printInvoice(inv)}
                              title="Print Invoice"
                              className="p-1 text-slate-500 hover:text-slate-900"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            {inv.status !== 'paid' && (
                              <button
                                onClick={() => {
                                  setPayingInvoice(inv);
                                  setPaymentAmount(String(outstanding));
                                }}
                                className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded"
                              >
                                Record Payment
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
      ) : (
        /* Customers Table */
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto financial-scroll">
            <table className="w-full text-xs min-w-[680px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-left">
                  <th className="py-2.5 px-4">Customer Name</th>
                  <th className="py-2.5 px-4">Email &amp; Phone</th>
                  <th className="py-2.5 px-4">Address</th>
                  <th className="py-2.5 px-4">Tax ID</th>
                  <th className="py-2.5 px-4 text-right">Credit Limit</th>
                  <th className="py-2.5 px-4 text-right">Outstanding Receivable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-4 font-bold text-slate-900">{c.name}</td>
                    <td className="py-2.5 px-4 text-slate-600">
                      <div>{c.email || '-'}</div>
                      <div className="text-[11px] text-slate-400">{c.phone || '-'}</div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{c.address || '-'}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">{c.taxNumber || '-'}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      {formatMoney(c.creditLimit, currencySymbol)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                      {formatMoney(c.currentBalance, currencySymbol)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold tracking-tight">Create Sales Invoice</h3>
                <p className="text-[11px] text-slate-400">
                  Automatically posts balanced journal: Debit AR, Credit Revenue &amp; Output Tax
                </p>
              </div>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Customer</label>
                  <select
                    required
                    value={invCustomerId}
                    onChange={(e) => setInvCustomerId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.taxNumber ? `(${c.taxNumber})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    required
                    value={invDate}
                    onChange={(e) => setInvDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={invDueDate}
                    onChange={(e) => setInvDueDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <div className="bg-slate-50 p-2.5 border-b border-slate-200 flex justify-between items-center">
                  <span className="font-bold text-slate-800">Invoice Line Items</span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-[11px] font-semibold text-slate-900 bg-white border border-slate-300 px-2.5 py-1 rounded hover:bg-slate-100"
                  >
                    + Add Item
                  </button>
                </div>

                <div className="overflow-x-auto financial-scroll max-h-72">
                  <table className="w-full text-xs min-w-[640px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 text-left">
                        <th className="py-2 px-3 w-1/4">Product / Service</th>
                        <th className="py-2 px-3">Description</th>
                        <th className="py-2 px-3 w-20 text-center">Qty</th>
                        <th className="py-2 px-3 w-28 text-right">Price ({currencySymbol})</th>
                        <th className="py-2 px-3 w-20 text-center">Tax %</th>
                        <th className="py-2 px-3 w-28 text-right font-bold">Line Total</th>
                        <th className="py-2 px-2 text-center w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((it, idx) => {
                        const lTotal = (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0);
                        return (
                          <tr key={idx}>
                            <td className="py-2 px-3">
                              <select
                                value={it.productId}
                                onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                                className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                              >
                                <option value="">Custom Service</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({p.code})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                required
                                value={it.description}
                                onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <input
                                type="number"
                                step="1"
                                min="1"
                                inputMode="numeric"
                                required
                                value={it.quantity}
                                onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                className="w-full px-2 py-1.5 border border-slate-300 rounded text-center text-xs"
                              />
                            </td>
                            <td className="py-2 px-3 text-right">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                inputMode="decimal"
                                required
                                value={it.unitPrice}
                                onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                                className="w-full px-2 py-1.5 border border-slate-300 rounded text-right font-mono text-xs"
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <select
                                value={it.taxRate}
                                onChange={(e) => handleItemChange(idx, 'taxRate', e.target.value)}
                                className="w-full px-2 py-1 border border-slate-300 rounded text-center text-xs"
                              >
                                <option value="15.00">15%</option>
                                <option value="5.00">5%</option>
                                <option value="0.00">0%</option>
                              </select>
                            </td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                              {formatMoney(lTotal, currencySymbol)}
                            </td>
                            <td className="py-2 px-2 text-center">
                              {items.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="text-slate-400 hover:text-red-600 p-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Totals Summary */}
                <div className="bg-slate-50 p-3 border-t border-slate-200 flex justify-end">
                  <div className="w-64 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal (Net):</span>
                      <span className="font-mono tabular-nums">{formatMoney(subtotal, currencySymbol)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Output VAT / Sales Tax:</span>
                      <span className="font-mono tabular-nums">{formatMoney(taxTotal, currencySymbol)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 border-t border-slate-300 pt-1 text-sm">
                      <span>Grand Total:</span>
                      <span className="font-mono tabular-nums">{formatMoney(invoiceTotal, currencySymbol)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Terms</label>
                  <input
                    type="text"
                    value={invTerms}
                    onChange={(e) => setInvTerms(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Invoice Remarks</label>
                  <input
                    type="text"
                    value={invNotes}
                    onChange={(e) => setInvNotes(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 font-semibold shadow-xs"
                >
                  {isSubmitting ? 'Posting Double Entry...' : 'Create & Post Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold tracking-tight">Record Customer Payment</h3>
                <p className="text-[11px] text-slate-400">
                  Invoice {payingInvoice.invoiceNumber} · {payingInvoice.customer?.name}
                </p>
              </div>
              <button
                onClick={() => setPayingInvoice(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="p-5 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded border border-slate-200">
                <div className="flex justify-between mb-1">
                  <span className="text-slate-500">Invoice Total:</span>
                  <span className="font-mono font-semibold">{formatMoney(payingInvoice.totalAmount, currencySymbol)}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-500">Previously Paid:</span>
                  <span className="font-mono text-emerald-700 font-semibold">{formatMoney(payingInvoice.amountPaid, currencySymbol)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-slate-200 pt-1">
                  <span>Current Outstanding:</span>
                  <span className="font-mono text-slate-900">
                    {formatMoney(parseFloat(payingInvoice.totalAmount) - parseFloat(payingInvoice.amountPaid), currencySymbol)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Payment Amount ({currencySymbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={parseFloat(payingInvoice.totalAmount) - parseFloat(payingInvoice.amountPaid)}
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded"
                >
                  <option value="BANK_TRANSFER">Bank Wire / ACH</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CARD">Credit / Debit Card</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPayingInvoice(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 font-semibold shadow-xs"
                >
                  {isSubmitting ? 'Posting...' : 'Record Payment & Settle AR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold tracking-tight">Register New Customer</h3>
                <p className="text-[11px] text-slate-400">Add client profile to accounts receivable ledger</p>
              </div>
              <button
                onClick={() => setShowCustomerModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateCustomerSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer / Organization Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corporation"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="billing@acme.com"
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Telephone</label>
                  <input
                    type="text"
                    placeholder="+1 555..."
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Business Address</label>
                <input
                  type="text"
                  placeholder="Street address, City, Country"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tax ID / VAT #</label>
                  <input
                    type="text"
                    placeholder="US-TAX-..."
                    value={custTax}
                    onChange={(e) => setCustTax(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Credit Limit ({currencySymbol})</label>
                  <input
                    type="number"
                    step="100"
                    value={custCreditLimit}
                    onChange={(e) => setCustCreditLimit(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 font-semibold shadow-xs"
                >
                  {isSubmitting ? 'Saving...' : 'Register Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
