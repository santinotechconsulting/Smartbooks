import React from 'react';
import { Printer, Download, X } from 'lucide-react';
import { Company } from '../types.ts';
import { formatMoney, downloadCSV } from '../utils/export.ts';

export interface DocumentData {
  title: string;
  documentNumber: string;
  date: string;
  dueDate?: string;
  recipientName?: string;
  recipientAddress?: string;
  recipientTaxId?: string;
  reference?: string;
  description?: string;
  preparedBy?: string;
  approvedBy?: string;
  status?: string;
  columns: { header: string; align?: 'left' | 'right' | 'center'; key: string }[];
  rows: Record<string, any>[];
  totals?: { label: string; value: string | number }[];
  notes?: string;
}

interface PrintDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: Company | null;
  document: DocumentData | null;
}

export const PrintDocumentModal: React.FC<PrintDocumentModalProps> = ({
  isOpen,
  onClose,
  company,
  document,
}) => {
  if (!isOpen || !document) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = document.columns.map((c) => c.header);
    const rowData = document.rows.map((row) =>
      document.columns.map((col) => String(row[col.key] ?? ''))
    );
    downloadCSV(
      `${document.title.replace(/\s+/g, '_')}_${document.documentNumber}`,
      headers,
      rowData
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Modal Controls (Hidden in Print) */}
        <div className="no-print p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500">Document</span>
            <span className="text-slate-300">·</span>
            <span className="text-xs text-slate-800 font-bold truncate max-w-[180px] sm:max-w-none">{document.title}</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors min-h-[38px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-xs min-h-[38px]"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-md min-h-[38px] min-w-[38px] flex items-center justify-center"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Canvas */}
        <div className="printable-document p-4 sm:p-8 overflow-y-auto bg-white flex-1 text-slate-800">
          {/* Company & Document Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-slate-900 pb-5 mb-5">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-8 h-8 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-tight shrink-0">
                  SB
                </div>
                <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight">
                  {company?.name || 'Apex Global Technologies Inc.'}
                </h1>
              </div>
              <p className="text-xs text-slate-600">{company?.address}, {company?.city}, {company?.country}</p>
              <p className="text-xs text-slate-600">
                Tax ID: <span className="font-mono">{company?.taxId || 'N/A'}</span> · Reg: <span className="font-mono">{company?.registrationNumber || 'N/A'}</span>
              </p>
              <p className="text-xs text-slate-600">{company?.email} · {company?.phone}</p>
            </div>

            <div className="sm:text-right">
              <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-slate-900">
                {document.title}
              </h2>
              <div className="text-xs sm:text-sm font-bold text-slate-800 font-mono mt-0.5">
                #{document.documentNumber}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Date: <span className="font-medium text-slate-800">{document.date}</span>
              </div>
              {document.dueDate && (
                <div className="text-xs text-slate-500">
                  Due: <span className="font-medium text-slate-800">{document.dueDate}</span>
                </div>
              )}
              {document.reference && (
                <div className="text-xs text-slate-500 font-mono">
                  Ref: {document.reference}
                </div>
              )}
            </div>
          </div>

          {/* Recipient / Counterparty Block */}
          {document.recipientName && (
            <div className="mb-5 p-3 sm:p-4 rounded bg-slate-50 border border-slate-200">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">
                Party / Particulars:
              </span>
              <div className="text-xs sm:text-sm font-bold text-slate-900">{document.recipientName}</div>
              {document.recipientAddress && (
                <div className="text-xs text-slate-600 mt-0.5">{document.recipientAddress}</div>
              )}
              {document.recipientTaxId && (
                <div className="text-xs text-slate-500 mt-0.5 font-mono">Tax ID: {document.recipientTaxId}</div>
              )}
            </div>
          )}

          {document.description && (
            <div className="mb-5 text-xs text-slate-700 bg-slate-50/50 p-2.5 rounded border border-slate-100">
              <span className="font-semibold text-slate-800">Description / Narration: </span>
              {document.description}
            </div>
          )}

          {/* Table Data (Mobile scrollable) */}
          <div className="mb-6 overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full text-xs border-collapse min-w-[500px] sm:min-w-full">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100/70">
                  {document.columns.map((col, idx) => (
                    <th
                      key={idx}
                      className={`py-2 px-3 font-semibold text-slate-700 ${
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                      }`}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {document.rows.map((row, rIdx) => (
                  <tr key={rIdx} className={rIdx % 2 === 1 ? 'bg-slate-50/40' : ''}>
                    {document.columns.map((col, cIdx) => (
                      <td
                        key={cIdx}
                        className={`py-2 px-3 ${
                          col.align === 'right'
                            ? 'text-right font-mono tabular-nums'
                            : col.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                        }`}
                      >
                        {row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          {document.totals && (
            <div className="flex justify-end mb-6">
              <div className="w-full sm:w-64 space-y-1.5 border-t border-slate-200 pt-3">
                {document.totals.map((t, idx) => (
                  <div
                    key={idx}
                    className={`flex justify-between text-xs ${
                      idx === document.totals!.length - 1
                        ? 'font-bold text-slate-900 border-t-2 border-slate-900 pt-2 text-sm'
                        : 'text-slate-600'
                    }`}
                  >
                    <span>{t.label}:</span>
                    <span className="font-mono tabular-nums">{t.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {document.notes && (
            <div className="mb-6 text-xs text-slate-500 border-l-2 border-slate-300 pl-3">
              <span className="font-semibold text-slate-700">Remarks: </span>
              {document.notes}
            </div>
          )}

          {/* Signatures & Approvals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-slate-200 pt-5 mt-8">
            <div>
              <div className="h-10 border-b border-dashed border-slate-400 mb-1"></div>
              <p className="text-xs font-semibold text-slate-800">
                Prepared By: {document.preparedBy || 'Accounts Officer'}
              </p>
              <p className="text-[10px] text-slate-500">Accountant / Signatory</p>
            </div>
            <div>
              <div className="h-10 border-b border-dashed border-slate-400 mb-1"></div>
              <p className="text-xs font-semibold text-slate-800">
                Approved By: {document.approvedBy || company?.authorisedSignatories || 'Managing Director'}
              </p>
              <p className="text-[10px] text-slate-500">Authorized Financial Controller</p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
            <p>{company?.documentFooter || 'Double-entry certified accounting records.'}</p>
            <p className="mt-0.5">Generated via SmartBooks System on {new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
