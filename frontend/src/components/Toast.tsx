/**
 * Toast — lightweight notification component.
 * Usage: <Toast message="..." type="success|error|info" onDismiss={() => ...} />
 */
import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  onDismiss: () => void;
  duration?: number;
}

const STYLES: Record<string, string> = {
  success: 'bg-emerald-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-blue-600 text-white',
  warning: 'bg-amber-500 text-white',
};

const ICONS: Record<string, string> = {
  success: 'check_circle',
  error: 'error',
  info: 'info',
  warning: 'warning',
};

export const Toast: React.FC<ToastProps> = ({ message, type = 'info', onDismiss, duration = 4000 }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom duration-300 max-w-sm ${STYLES[type]}`}
    >
      <span className="material-symbols-outlined text-lg">{ICONS[type]}</span>
      <span className="text-sm font-semibold flex-1">{message}</span>
      <button
        onClick={onDismiss}
        className="ml-2 hover:opacity-75 cursor-pointer text-xs font-bold uppercase tracking-wider"
      >
        ✕
      </button>
    </div>
  );
};

// ─── useToast hook ────────────────────────────────────────────────────────────
import { useState, useCallback } from 'react';

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: ToastState['type'] = 'info') => {
    setToast({ message, type });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  return { toast, showToast, dismissToast };
}
