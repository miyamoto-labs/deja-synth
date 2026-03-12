'use client';

import { useState, useRef, useEffect } from 'react';
import { generatePnlCard } from '@/app/lib/utils/generatePnlCard';
import { useToast } from './Toast';

interface PnlPosition {
  question: string;
  outcome: string;
  pnl: number;
  pnlPercent: number;
  size: number;
  avgPrice: number;
  curPrice: number;
  currentValue: number;
  resolved?: boolean;
  createdAt?: string | null;
}

export function PnlShareButton({ position }: { position: PnlPosition }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const shareToX = () => {
    const sign = position.pnl >= 0 ? '+' : '';
    const emoji = position.pnl >= 0 ? '🟢' : '🔴';
    const q = position.question.length > 60
      ? position.question.slice(0, 57) + '...'
      : position.question;
    const text = encodeURIComponent(
      `${emoji} ${sign}$${Math.abs(position.pnl).toFixed(2)} (${sign}${position.pnlPercent.toFixed(1)}%) on "${q}"\n\nvia @DejaTradeApp — deja.trade`
    );
    window.open(`https://x.com/intent/tweet?text=${text}`, '_blank');
    setOpen(false);
  };

  const downloadPng = async () => {
    setLoading(true);
    try {
      const blob = await generatePnlCard(position);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deja-pnl-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('success', 'Downloaded!', 'PnL card saved as PNG');
    } catch {
      toast('error', 'Failed', 'Could not generate PnL card');
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className="text-[10px] font-semibold px-2 py-1 rounded-lg border border-ep-border text-text-muted hover:text-text-primary hover:border-ep-border-bright transition disabled:opacity-50"
        title="Share PnL"
      >
        {loading ? (
          <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-xl bg-ep-surface border border-ep-border shadow-card overflow-hidden">
          <button
            onClick={shareToX}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-text-secondary hover:text-text-primary hover:bg-white/5 transition"
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Share to X
          </button>
          <div className="border-t border-ep-border" />
          <button
            onClick={downloadPng}
            disabled={loading}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-text-secondary hover:text-text-primary hover:bg-white/5 transition disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download PNG
          </button>
        </div>
      )}
    </div>
  );
}
