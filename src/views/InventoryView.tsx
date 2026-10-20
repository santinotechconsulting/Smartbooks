import React, { useState } from 'react';
import { Boxes, Plus, Search, Download, Printer, AlertTriangle } from 'lucide-react';
import { Company, Product, Account } from '../types.ts';
import { formatMoney, downloadCSV } from '../utils/export.ts';

interface InventoryViewProps {
  company: Company | null;
  products: Product[];
  accounts: Account[];
  onRefresh: () => void;
  onOpenPrintModal: (doc: any) => void;
  onCreateProduct: (data: any) => Promise<void>;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  company,
  products,
  accounts,
  onRefresh,
  onOpenPrintModal,
  onCreateProduct,
  showToast,
}) => {
  const currencySymbol = company?.currencySymbol || '$';
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Form states
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Hardware');
  const [unit, setUnit] = useState('unit');
  const [purchaseCost, setPurchaseCost] = useState('0.00');
  const [sellingPrice, setSellingPrice] = useState('0.00');
  const [quantity, setQuantity] = useState('10');
  const [reorderLevel, setReorderLevel] = useState('5');
  const [costingMethod, setCostingMethod] = useState('FIFO');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalInventoryValuation = products.reduce(
    (sum, p) => sum + parseFloat(p.quantityOnHand || '0') * parseFloat(p.purchaseCost || '0'),
    0
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onCreateProduct({
        companyId: company?.id,
        code,
        name,
        category,
        unit,
        purchaseCost,
        sellingPrice,
        quantityOnHand: quantity,
        reorderLevel,
        costingMethod,
      });
      setShowModal(false);
      setCode('');
      setName('');
      if (showToast) showToast(`Product "${name}" added to inventory catalog!`, 'success');
      onRefresh();
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Failed to create product', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      !searchQuery ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exportCSV = () => {
    const headers = ['Code', 'Name', 'Category', 'Unit', 'Qty on Hand', 'Unit Cost', 'Selling Price', 'Total Valuation'];
    const rows = filteredProducts.map((p) => [
      p.code,
      p.name,
      p.category,
      p.unit,
      p.quantityOnHand,
      p.purchaseCost,
      p.sellingPrice,
      parseFloat(p.quantityOnHand) * parseFloat(p.purchaseCost),
    ]);
    downloadCSV(`Inventory_Valuation_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  const printReport = () => {
    onOpenPrintModal({
      title: 'Inventory Stock Valuation Report',
      documentNumber: `INV-VAL-${new Date().getFullYear()}`,
      date: new Date().toISOString().slice(0, 10),
      description: `Perpetual stock valuation under FIFO / Weighted-Average Costing`,
      columns: [
        { header: 'Product Code', key: 'code' },
        { header: 'Item Name', key: 'name' },
        { header: 'Category', key: 'category' },
        { header: 'Unit Qty', key: 'quantityOnHand', align: 'center' },
        { header: 'Unit Cost', key: 'purchaseCost', align: 'right' },
        { header: 'Selling Price', key: 'sellingPrice', align: 'right' },
        { header: 'Asset Value', key: 'totalValue', align: 'right' },
      ],
      rows: filteredProducts.map((p) => ({
        code: p.code,
        name: p.name,
        category: p.category,
        quantityOnHand: p.quantityOnHand,
        purchaseCost: formatMoney(p.purchaseCost, currencySymbol),
        sellingPrice: formatMoney(p.sellingPrice, currencySymbol),
        totalValue: formatMoney(parseFloat(p.quantityOnHand) * parseFloat(p.purchaseCost), currencySymbol),
      })),
      totals: [
        { label: 'Total Stock Valuation', value: formatMoney(totalInventoryValuation, currencySymbol) },
      ],
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Stat & Action Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Total Inventory Valuation
          </span>
          <span className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1 block">
            {formatMoney(totalInventoryValuation, currencySymbol)}
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Integrated with Merchandise Inventory Account [1300]
          </span>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Catalog SKUs
          </span>
          <span className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1 block">
            {products.length} Products
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">Configured for perpetual COGS</span>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Costing Method
            </span>
            <span className="text-base font-bold text-slate-900 mt-1 block">FIFO Perpetual</span>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Product</span>
          </button>
        </div>
      </div>

      {/* Filter and Export Bar */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search SKU code, product name..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={printReport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Valuation</span>
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto financial-scroll">
          <table className="w-full text-xs min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-left">
                <th className="py-2.5 px-4">SKU Code</th>
                <th className="py-2.5 px-4">Product Name</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4 text-center">Unit</th>
                <th className="py-2.5 px-4 text-center">Qty on Hand</th>
                <th className="py-2.5 px-4 text-right">Cost Price</th>
                <th className="py-2.5 px-4 text-right">Selling Price</th>
                <th className="py-2.5 px-4 text-right font-bold">Total Asset Valuation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p) => {
                const isLow = parseFloat(p.quantityOnHand) <= parseFloat(p.reorderLevel);
                const assetVal = parseFloat(p.quantityOnHand) * parseFloat(p.purchaseCost);
                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{p.code}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">{p.name}</td>
                    <td className="py-2.5 px-4 text-slate-600">{p.category}</td>
                    <td className="py-2.5 px-4 text-center text-slate-500">{p.unit}</td>
                    <td className="py-2.5 px-4 text-center font-mono tabular-nums">
                      <span className={`font-semibold ${isLow ? 'text-amber-700' : 'text-slate-900'}`}>
                        {p.quantityOnHand}
                      </span>
                      {isLow && (
                        <span className="ml-1 text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-bold">
                          LOW
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      {formatMoney(p.purchaseCost, currencySymbol)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900 font-semibold">
                      {formatMoney(p.sellingPrice, currencySymbol)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                      {formatMoney(assetVal, currencySymbol)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold tracking-tight">Create Inventory Item</h3>
                <p className="text-[11px] text-slate-400">Add SKU to inventory and perpetual costing ledger</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-lg font-bold">
                ×
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">SKU Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PRD-003"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Item Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dell PowerEdge Rack Server"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Purchase Cost ({currencySymbol})</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={purchaseCost}
                    onChange={(e) => setPurchaseCost(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Selling Price ({currencySymbol})</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Initial Quantity</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Reorder Level</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono"
                  />
                </div>
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
                  {isSubmitting ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
