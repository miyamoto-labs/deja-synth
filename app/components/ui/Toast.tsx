'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type ToastType = 'success' | 'error' | 'info' | 'signal';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextType {
  toast: (type: ToastType, title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, title: string, description?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, title, description }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const iconMap: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    signal: '🎯',
  };

  const colorMap: Record<ToastType, { border: string; bg: string; text: string }> = {
    success: { border: '#00F0A020', bg: 'rgba(0, 240, 160, 0.08)', text: '#00F0A0' },
    error: { border: '#FF406020', bg: 'rgba(255, 64, 96, 0.08)', text: '#FF4060' },
    info: { border: '#60A5FA20', bg: 'rgba(96, 165, 250, 0.08)', text: '#60A5FA' },
    signal: { border: '#F0B00020', bg: 'rgba(240, 176, 0, 0.08)', text: '#F0B000' },
  };

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => {
            const colors = colorMap[t.type];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20, x: 20 }}
                animate={{ opacity: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ duration: 0.3 }}
                className="pointer-events-auto glass-bright rounded-xl px-4 py-3 max-w-sm shadow-card"
                style={{ borderColor: colors.border }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                    style={{ background: colors.bg, color: colors.text }}
                  >
                    {iconMap[t.type]}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{t.title}</p>
                    {t.description && (
                      <p className="text-xs text-text-secondary mt-0.5">{t.description}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
