import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export function Toast({ id, message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [id, onClose]);

  return (
    <div className={`
      flex items-center gap-3 px-5 py-4 rounded-2xl border shadow-lg w-full bg-white text-base font-bold
      transition-all duration-300 transform translate-x-0
      ${type === 'success'
        ? 'text-emerald-950 border-emerald-100 bg-emerald-55/90 backdrop-blur-md shadow-emerald-100/40'
        : 'text-red-950 border-red-100 bg-red-55/90 backdrop-blur-md shadow-red-100/40'
      }
    `}>
      <span className="shrink-0">
        {type === 'success' ? (
          <CheckCircle2 className="text-emerald-600" size={24} />
        ) : (
          <AlertCircle className="text-red-600" size={24} />
        )}
      </span>
      <div className="flex-1 leading-snug font-semibold">{message}</div>
      <button
        onClick={() => onClose(id)}
        className="p-1 hover:bg-slate-900/5 rounded-lg text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export default function ToastContainer({ toasts, onClose }) {
  return (
    <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 w-full max-w-[22rem] pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto w-full transition-all duration-300">
          <Toast
            id={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={onClose}
          />
        </div>
      ))}
    </div>
  );
}
