import React, { useState } from 'react';
import { Building2, Plus, Download, Printer, Calculator, CheckCircle2 } from 'lucide-react';
import { Company, FixedAsset, Account } from '../types.ts';
import { formatMoney, downloadCSV } from '../utils/export.ts';

interface FixedAssetsViewProps {
  company: Company | null;
  assets: FixedAsset[];
  accounts: Account[];
  onRefresh: () => void;
  onOpenPrintModal: (doc: any) => void;
  onPostDepreciation: (assetId: number, period: string, amount: string) => Promise<void>;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const FixedAssetsView: React.FC<FixedAssetsViewProps> = ({
  company,
  assets,
  accounts,
  onRefresh,
  onOpenPrintModal,
  onPostDepreciation,
  showToast,
}) => {
  const currencySymbol = company?.currencySymbol || '$';
  const [depreciatingAsset, setDepreciatingAsset] = useState<FixedAsset | null>(null);
  const [depPeriod, setDepPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [depAmount, setDepAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalAcquisition = assets.reduce((sum, a) => sum + parseFloat(a.acquisitionCost || '0'), 0);
  const totalDepreciation = assets.reduce((sum, a) => sum + parseFloat(a.accumulatedDepreciation || '0'), 0);
  const totalNBV = assets.reduce((sum, a) => sum + parseFloat(a.netBookValue || '0'), 0);

  const openDepreciateModal = (a: FixedAsset) => {
    setDepreciatingAsset(a);
    // Auto calculate monthly straight-line depreciation: (Cost - Residual) / (UsefulLifeYears * 12)
    const cost = parseFloat(a.acquisitionCost);
    const residual = parseFloat(a.residualValue || '0');
    const monthlyDep = (cost - residual) / (a.usefulLifeYears * 12);
    setDepAmount(monthlyDep.toFixed(2));
  };

  const handlePostDepreciationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depreciatingAsset || !depAmount) return;
    setIsSubmitting(true);
    try {
      await onPostDepreciation(depreciatingAsset.id, depPeriod, depAmount);
      if (showToast) showToast(`Posted monthly depreciation of ${formatMoney(depAmount, currencySymbol)}!`, 'success');
      setDepreciatingAsset(null);
      onRefresh();
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Failed to post depreciation', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Asset Code', 'Name', 'Acquisition Date', 'Cost', 'Life (Yrs)', 'Method', 'Accum. Dep.', 'Net Book Value'];
    const rows = assets.map((a) => [
      a.assetCode,
      a.name,
      a.acquisitionDate,
      a.acquisitionCost,
      a.usefulLifeYears,
      a.depreciationMethod,
      a.accumulatedDepreciation,
      a.netBookValue,
    ]);
    downloadCSV(`Fixed_Assets_Register_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  const printRegister = () => {
    onOpenPrintModal({
      title: 'Fixed Assets Register & Depreciation Schedule',
      documentNumber: `FAR-${new Date().getFullYear()}`,
      date: new Date().toISOString().slice(0, 10),
      description: `Capitalized assets, accumulated depreciation, and net book values`,
      columns: [
        { header: 'Asset Code', key: 'assetCode' },
        { header: 'Asset Name', key: 'name' },
        { header: 'Acq. Date', key: 'acquisitionDate' },
        { header: 'Cost', key: 'cost', align: 'right' },
        { header: 'Method', key: 'depreciationMethod' },
        { header: 'Accum. Dep.', key: 'accumDep', align: 'right' },
        { header: 'Net Book Value', key: 'nbv', align: 'right' },
      ],
      rows: assets.map((a) => ({
        assetCode: a.assetCode,
        name: a.name,
        acquisitionDate: a.acquisitionDate,
        cost: formatMoney(a.acquisitionCost, currencySymbol),
        depreciationMethod: a.depreciationMethod,
        accumDep: formatMoney(a.accumulatedDepreciation, currencySymbol),
        nbv: formatMoney(a.netBookValue, currencySymbol),
      })),
      totals: [
        { label: 'Total Capitalized Cost', value: formatMoney(totalAcquisition, currencySymbol) },
        { label: 'Total Accumulated Depreciation', value: `(${formatMoney(totalDepreciation, currencySymbol)})` },
        { label: 'Total Net Book Value', value: formatMoney(totalNBV, currencySymbol) },
      ],
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Asset Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Capitalized Asset Cost
          </span>
          <span className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1 block">
            {formatMoney(totalAcquisition, currencySymbol)}
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">Historical acquisition basis</span>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Accumulated Depreciation
          </span>
          <span className="text-xl font-bold font-mono tabular-nums text-amber-700 mt-1 block">
            {formatMoney(totalDepreciation, currencySymbol)}
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">Contra asset write-down</span>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Total Net Book Value (NBV)
          </span>
          <span className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1 block">
            {formatMoney(totalNBV, currencySymbol)}
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">Reflected in Balance Sheet</span>
        </div>
      </div>

      {/* Action Strip */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex items-center justify-between">
        <span className="text-xs font-bold text-slate-800">
          Asset Register ({assets.length} Capitalized Items)
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={printRegister}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Register</span>
          </button>
        </div>
      </div>

      {/* Asset Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto financial-scroll">
          <table className="w-full text-xs min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-left">
                <th className="py-2.5 px-4">Code</th>
                <th className="py-2.5 px-4">Asset Name</th>
                <th className="py-2.5 px-4">Acquisition Date</th>
                <th className="py-2.5 px-4 text-center">Life (Yrs)</th>
                <th className="py-2.5 px-4">Method</th>
                <th className="py-2.5 px-4 text-right">Cost Basis</th>
                <th className="py-2.5 px-4 text-right">Accum. Dep.</th>
                <th className="py-2.5 px-4 text-right font-bold">Net Book Value</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assets.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{a.assetCode}</td>
                  <td className="py-2.5 px-4">
                    <div className="font-semibold text-slate-900">{a.name}</div>
                    <div className="text-[11px] text-slate-500">{a.department || a.location || 'HQ'}</div>
                  </td>
                  <td className="py-2.5 px-4 text-slate-600">{a.acquisitionDate}</td>
                  <td className="py-2.5 px-4 text-center text-slate-700">{a.usefulLifeYears}</td>
                  <td className="py-2.5 px-4 text-slate-600">{a.depreciationMethod}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                    {formatMoney(a.acquisitionCost, currencySymbol)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-700">
                    {formatMoney(a.accumulatedDepreciation, currencySymbol)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                    {formatMoney(a.netBookValue, currencySymbol)}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      onClick={() => openDepreciateModal(a)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded"
                    >
                      Post Depreciation
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Depreciate Modal */}
      {depreciatingAsset && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold tracking-tight">Post Asset Depreciation</h3>
                <p className="text-[11px] text-slate-400">
                  {depreciatingAsset.name} ({depreciatingAsset.assetCode})
                </p>
              </div>
              <button
                onClick={() => setDepreciatingAsset(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handlePostDepreciationSubmit} className="p-5 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded border border-slate-200">
                <div className="flex justify-between mb-1">
                  <span className="text-slate-500">Acquisition Cost:</span>
                  <span className="font-mono font-semibold">{formatMoney(depreciatingAsset.acquisitionCost, currencySymbol)}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-500">Current Accum. Depreciation:</span>
                  <span className="font-mono text-amber-700 font-semibold">{formatMoney(depreciatingAsset.accumulatedDepreciation, currencySymbol)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-slate-200 pt-1">
                  <span>Net Book Value:</span>
                  <span className="font-mono text-slate-900">{formatMoney(depreciatingAsset.netBookValue, currencySymbol)}</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Accounting Period (YYYY-MM)</label>
                <input
                  type="month"
                  required
                  value={depPeriod}
                  onChange={(e) => setDepPeriod(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Depreciation Amount to Post ({currencySymbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={depAmount}
                  onChange={(e) => setDepAmount(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono font-bold text-sm"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Debit Account [5100] Depreciation Expense, Credit Account [1510] Accumulated Depreciation
                </span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDepreciatingAsset(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 font-semibold shadow-xs"
                >
                  {isSubmitting ? 'Posting Journal...' : 'Confirm & Post Journal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
