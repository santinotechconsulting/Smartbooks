import React, { useState } from 'react';
import {
  ShieldCheck,
  Building,
  Lock,
  Unlock,
  Search,
  Download,
  Save,
  Clock,
  Key,
} from 'lucide-react';
import { Company, AuditLog } from '../types.ts';
import { downloadCSV } from '../utils/export.ts';

interface AuditAndSettingsViewProps {
  company: Company | null;
  auditLogs: AuditLog[];
  onRefresh: () => void;
  onUpdateCompany: (data: any) => Promise<void>;
  onOpenNewCompanyModal: () => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AuditAndSettingsView: React.FC<AuditAndSettingsViewProps> = ({
  company,
  auditLogs,
  onRefresh,
  onUpdateCompany,
  onOpenNewCompanyModal,
  showToast,
}) => {
  const [tab, setTab] = useState<'AUDIT' | 'COMPANY'>('AUDIT');
  const [searchLog, setSearchLog] = useState('');

  // Company Form
  const [name, setName] = useState(company?.name || '');
  const [tradingName, setTradingName] = useState(company?.tradingName || '');
  const [taxId, setTaxId] = useState(company?.taxId || '');
  const [regNo, setRegNo] = useState(company?.registrationNumber || '');
  const [address, setAddress] = useState(company?.address || '');
  const [city, setCity] = useState(company?.city || '');
  const [country, setCountry] = useState(company?.country || 'United States');
  const [currency, setCurrency] = useState(company?.currency || 'USD');
  const [currencySymbol, setCurrencySymbol] = useState(company?.currencySymbol || '$');
  const [fyStart, setFyStart] = useState(company?.financialYearStart || '01-01');
  const [fyEnd, setFyEnd] = useState(company?.financialYearEnd || '12-31');
  const [accMethod, setAccMethod] = useState(company?.accountingMethod || 'ACCRUAL');
  const [isLocked, setIsLocked] = useState(company?.isLocked || false);
  const [signatories, setSignatories] = useState(company?.authorisedSignatories || '');
  const [footer, setFooter] = useState(company?.documentFooter || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setIsSaving(true);
    try {
      await onUpdateCompany({
        name,
        tradingName,
        taxId,
        registrationNumber: regNo,
        address,
        city,
        country,
        currency,
        currencySymbol,
        financialYearStart: fyStart,
        financialYearEnd: fyEnd,
        accountingMethod: accMethod,
        isLocked,
        authorisedSignatories: signatories,
        documentFooter: footer,
      });
      if (showToast) showToast('Company profile and accounting configurations updated!', 'success');
      onRefresh();
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Failed to update company', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredLogs = auditLogs.filter(
    (l) =>
      !searchLog ||
      l.action.toLowerCase().includes(searchLog.toLowerCase()) ||
      l.entityType.toLowerCase().includes(searchLog.toLowerCase()) ||
      l.details.toLowerCase().includes(searchLog.toLowerCase()) ||
      (l.userEmail && l.userEmail.toLowerCase().includes(searchLog.toLowerCase()))
  );

  const exportAuditCSV = () => {
    const headers = ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'Details'];
    const rows = filteredLogs.map((l) => [
      l.createdAt,
      l.userEmail || l.userId || 'system',
      l.action,
      l.entityType,
      l.entityId,
      l.details,
    ]);
    downloadCSV(`Audit_Trail_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 self-start w-fit">
        <button
          onClick={() => setTab('AUDIT')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            tab === 'AUDIT' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Compliance Audit Trail ({auditLogs.length})
        </button>
        <button
          onClick={() => setTab('COMPANY')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            tab === 'COMPANY' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Company Profile &amp; Period Locking
        </button>
      </div>

      {tab === 'AUDIT' ? (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchLog}
                onChange={(e) => setSearchLog(e.target.value)}
                placeholder="Search audit actions, users, records..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button
                onClick={exportAuditCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Audit CSV</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-left">
                    <th className="py-2.5 px-4">Timestamp</th>
                    <th className="py-2.5 px-4">User / Actor</th>
                    <th className="py-2.5 px-4">Action</th>
                    <th className="py-2.5 px-4">Target Entity</th>
                    <th className="py-2.5 px-4">Record ID</th>
                    <th className="py-2.5 px-4">Audit Details &amp; Change Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {new Date(l.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-800">
                        {l.userEmail || l.userId || 'System Engine'}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                          {l.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-700">{l.entityType}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-500">{l.entityId}</td>
                      <td className="py-2.5 px-4 text-slate-700 max-w-md">{l.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Company Settings Form */
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs max-w-3xl">
          <form onSubmit={handleSaveCompany} className="space-y-5 text-xs">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Entity Profile &amp; Governance</h3>
                <p className="text-[11px] text-slate-500">Legal credentials, base currency, and lock controls</p>
              </div>
              <button
                type="button"
                onClick={onOpenNewCompanyModal}
                className="px-3 py-1.5 text-xs font-semibold text-slate-900 border border-slate-300 rounded hover:bg-slate-50"
              >
                + Register Another Entity
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Legal Company Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-semibold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Trading / Brand Name</label>
                <input
                  type="text"
                  value={tradingName}
                  onChange={(e) => setTradingName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tax ID / VAT Registration #</label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company Registration #</label>
                <input
                  type="text"
                  value={regNo}
                  onChange={(e) => setRegNo(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Registered Business Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Base Currency</label>
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Financial Year Start</label>
                <input
                  type="text"
                  placeholder="MM-DD (e.g. 01-01)"
                  value={fyStart}
                  onChange={(e) => setFyStart(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Financial Year End</label>
                <input
                  type="text"
                  placeholder="MM-DD (e.g. 12-31)"
                  value={fyEnd}
                  onChange={(e) => setFyEnd(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Accounting Basis</label>
                <select
                  value={accMethod}
                  onChange={(e) => setAccMethod(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded font-medium"
                >
                  <option value="ACCRUAL">Accrual Accounting</option>
                  <option value="CASH">Cash Accounting</option>
                </select>
              </div>
            </div>

            {/* Period Lock Control */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block">Accounting Period Lock</span>
                <span className="text-[11px] text-slate-500">
                  When locked, prevents modification or posting of backdated transactions into closed financial years.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsLocked(!isLocked)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                  isLocked
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}
              >
                {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                <span>{isLocked ? 'Period Locked' : 'Period Open'}</span>
              </button>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Authorised Signatories</label>
              <input
                type="text"
                value={signatories}
                onChange={(e) => setSignatories(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Standard Document Footer</label>
              <input
                type="text"
                value={footer}
                onChange={(e) => setFooter(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded"
              />
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-slate-900 text-white rounded font-semibold hover:bg-slate-800 shadow-xs flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Updating...' : 'Save Configuration'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
