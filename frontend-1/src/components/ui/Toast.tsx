'use client';

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  actions?: ToastAction[];
  onDismiss?: () => void;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Toast Provider
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => {
      const toast = prev.find((t) => t.id === id);
      if (toast?.onDismiss) {
        toast.onDismiss();
      }
      return prev.filter((t) => t.id !== id);
    });
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

// Toast Container
function ToastContainer({
  toasts,
  removeToast,
}: {
  toasts: Toast[];
  removeToast: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// Individual Toast
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { type, title, message, duration = 5000, actions } = toast;

  useEffect(() => {
    // Don't auto-dismiss if there are actions
    if (actions && actions.length > 0) return;
    if (duration === 0) return;

    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss, actions]);

  const icons = {
    success: <CheckCircle size={20} />,
    error: <AlertCircle size={20} />,
    warning: <AlertTriangle size={20} />,
    info: <Info size={20} />,
  };

  const colors = {
    success: {
      bg: 'bg-[var(--color-success)]/10',
      border: 'border-[var(--color-success)]/20',
      icon: 'text-[var(--color-success)]',
    },
    error: {
      bg: 'bg-[var(--color-error)]/10',
      border: 'border-[var(--color-error)]/20',
      icon: 'text-[var(--color-error)]',
    },
    warning: {
      bg: 'bg-[var(--color-amber)]/10',
      border: 'border-[var(--color-amber)]/20',
      icon: 'text-[var(--color-amber)]',
    },
    info: {
      bg: 'bg-[var(--color-info)]/10',
      border: 'border-[var(--color-info)]/20',
      icon: 'text-[var(--color-info)]',
    },
  };

  const colorScheme = colors[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={clsx(
        'pointer-events-auto rounded-xl border p-4 shadow-lg backdrop-blur-sm',
        colorScheme.bg,
        colorScheme.border,
        'bg-white/95'
      )}
    >
      <div className="flex items-start gap-3">
        <span className={clsx('flex-shrink-0 mt-0.5', colorScheme.icon)}>{icons[type]}</span>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-[var(--color-ink)] text-sm">{title}</h4>
          {message && (
            <p className="mt-1 text-sm text-[var(--color-stone)]">{message}</p>
          )}
          {actions && actions.length > 0 && (
            <div className="mt-3 flex gap-2">
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => {
                    action.onClick();
                    onDismiss();
                  }}
                  className={clsx(
                    'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                    action.variant === 'secondary'
                      ? 'bg-[var(--color-parchment)] text-[var(--color-slate)] hover:bg-[var(--color-sand)]'
                      : 'bg-[var(--color-forest)] text-white hover:bg-[var(--color-forest-light)]'
                  )}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded-lg text-[var(--color-stone)] hover:text-[var(--color-ink)] hover:bg-[var(--color-parchment)] transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </motion.div>
  );
}

export default ToastProvider;

