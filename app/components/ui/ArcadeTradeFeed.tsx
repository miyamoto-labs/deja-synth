'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Types ──────────────────────────────────────── */
interface TradeEvent {
  time: string;
  side: string; // 'BUY' or 'SELL'
  outcome: string; // 'Yes' or 'No'
  price: number;
  size: number;
  user: string;
}

interface ArcadeTradeFeedProps {
  conditionId: string | null;
  assetLabel?: string;
}

/* ── Relative time helper ── */
function timeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 5) return 'now';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

/* ── Component ─────────────────────────────────── */
export function ArcadeTradeFeed({ conditionId, assetLabel = 'BTC' }: ArcadeTradeFeedProps) {
  const [trades, setTrades] = useState<TradeEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchTrades = useCallback(async () => {
    if (!conditionId) return;

    try {
      const res = await fetch(
        `/api/polymarket/trades?conditionId=${encodeURIComponent(conditionId)}`
      );
      if (res.ok) {
        const data = await res.json();
        setTrades(data.trades || []);
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [conditionId]);

  useEffect(() => {
    if (!conditionId) return;
    setLoading(true);
    fetchTrades();
    const iv = setInterval(fetchTrades, 5000); // Poll every 5 seconds
    return () => clearInterval(iv);
  }, [conditionId, fetchTrades]);

  if (!conditionId) {
    return (
      <div className="ep-card p-4">
        <p className="text-[10px] text-text-muted text-center">No active market</p>
      </div>
    );
  }

  return (
    <div className="ep-card overflow-hidden">
      <div className="px-3 py-2 border-b border-ep-border flex items-center justify-between">
        <h3 className="text-[10px] font-semibold text-text-primary uppercase tracking-wider">
          Live Trades
        </h3>
        <span className="text-[9px] text-text-muted">{assetLabel} 5m</span>
      </div>

      {loading && trades.length === 0 ? (
        <div className="p-6 text-center">
          <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto" />
        </div>
      ) : trades.length === 0 ? (
        <div className="p-4 text-center">
          <p className="text-[10px] text-text-muted">No recent trades</p>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="max-h-[200px] overflow-y-auto divide-y divide-ep-border/30 text-[10px] font-mono"
        >
          <AnimatePresence initial={false}>
            {trades.map((trade, i) => {
              const isUp = trade.outcome === 'Yes';
              const isBuy = trade.side === 'BUY';

              return (
                <motion.div
                  key={`${trade.time}-${i}`}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-4 px-3 py-1 items-center hover:bg-ep-surface/30"
                >
                  <span className="text-text-muted">{timeAgo(trade.time)}</span>
                  <span className={isUp ? 'text-profit' : 'text-loss'}>
                    {isBuy ? 'BUY' : 'SELL'} {isUp ? 'UP' : 'DN'}
                  </span>
                  <span className="text-right text-text-secondary">
                    {(trade.price * 100).toFixed(1)}c
                  </span>
                  <span className="text-right text-text-muted">
                    ${(trade.price * trade.size).toFixed(2)}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
