import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:top-6 z-50 flex flex-col gap-2 max-w-md pointer-events-none no-print">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg shadow-lg border text-xs sm:text-sm font-medium transition-all transform translate-y-0 ${
            t.type === 'success'
              ? 'bg-emerald-950 text-emerald-100 border-emerald-800'
              : t.type === 'error'
              ? 'bg-red-950 text-red-100 border-red-800'
              : 'bg-slate-900 text-slate-100 border-slate-700'
          }`}
        >
          {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
          {t.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
          {t.type === 'info' && <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />}
          <div className="flex-1 leading-snug">{t.message}</div>
          <button
            onClick={() => onDismiss(t.id)}
            className="text-slate-400 hover:text-white p-0.5 rounded transition-colors shrink-0"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
