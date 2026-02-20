import { useToast } from '../context/ToastContext';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export function ToastContainer() {
  const { toasts, removeToast } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            flex items-start gap-3 px-4 py-3 rounded-xl shadow-xl border
            min-w-[300px] max-w-[420px] pointer-events-auto animate-slide-in
            ${toast.type === 'success' ? 'bg-emerald-950 border-emerald-700/60 text-emerald-100' : ''}
            ${toast.type === 'error' ? 'bg-red-950 border-red-700/60 text-red-100' : ''}
            ${toast.type === 'info' ? 'bg-slate-800 border-slate-600/60 text-slate-100' : ''}
          `}
        >
          <span className="mt-0.5 shrink-0">
            {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-slate-400" />}
          </span>
          <span className="text-sm flex-1 leading-relaxed">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 mt-0.5 opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
