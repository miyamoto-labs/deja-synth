'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip } from './Tooltip';

/* ── Types ────────────────────────────────── */
interface ActivityItem {
  id: string;
  traderId: string;
  marketId: string;
  direction: string;
  amount: number;
  price: number;
  tradeType: string;
  timestamp: string;
  traderAlias: string;
  traderWallet: string;
  traderTier: string;
  traderStyle: string;
  traderRoi: number;
  traderPnl: number;
  question: string;
  marketSlug: string;
  polymarketUrl: string;
  yesPrice: number | null;
  noPrice: number | null;
  volume: number;
  endDate: string | null;
}

interface TraderActivityFeedProps {
  /** Filter to a single trader */
  traderId?: string;
  /** Max items to show (default: 30) */
  maxItems?: number;
  /** Compact mode for embedding in cards */
  compact?: boolean;
  /** Element ID to scroll to (shows "Skip to X ↓" button in header) */
  skipToId?: string;
  /** Label for the skip button (default: "Traders") */
  skipToLabel?: string;
}

/* ── Helpers ───────────────────────────────── */
function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatAmount(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

const tierColors: Record<string, string> = {
  micro: '#A78BFA',
  small: '#60A5FA',
  mid: '#FBBF24',
  whale: '#34D399',
};

/* ── Component ─────────────────────────────── */
export function TraderActivityFeed({ traderId, maxItems = 30, compact = false, skipToId, skipToLabel = 'Traders' }: TraderActivityFeedProps) {
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);

  const fetchActivity = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: String(maxItems), hours: '24' });
      if (traderId) params.set('trader', traderId);
      const res = await fetch(`/api/traders/activity?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setActivity(data.activity || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [traderId, maxItems]);

  // Initial fetch
  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  // Auto-refresh every 30s when live
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(fetchActivity, 30_000);
    return () => clearInterval(interval);
  }, [isLive, fetchActivity]);

  if (loading) {
    return (
      <div className="ep-card p-4 sm:p-5 border border-ep-border/60">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-2 w-2 rounded-full bg-accent/30 animate-pulse" />
          <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3 border-b border-ep-border/30 last:border-0">
            <div className="h-8 w-8 rounded-full bg-white/5 animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-3/4 bg-white/5 rounded animate-pulse" />
              <div className="h-2.5 w-1/2 bg-white/5 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error && activity.length === 0) {
    return (
      <div className="ep-card p-6 text-center border border-ep-border/60">
        <p className="text-sm text-text-muted">Unable to load activity feed</p>
      </div>
    );
  }

  return (
    <div className="ep-card border border-ep-border/60 overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-5 py-3 border-b border-ep-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`h-2 w-2 rounded-full ${isLive ? 'bg-profit animate-pulse' : 'bg-text-muted'}`} />
          <h2 className="font-display font-semibold text-sm text-text-primary">
            Live Trader Activity
          </h2>
          <span className="text-[10px] text-text-muted font-mono">
            {activity.length} trades
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLive(!isLive)}
            className={`px-2 py-1 rounded text-[10px] font-semibold transition ${
              isLive
                ? 'bg-profit/15 text-profit border border-profit/20'
                : 'bg-white/5 text-text-muted border border-white/10 hover:text-text-secondary'
            }`}
          >
            {isLive ? 'LIVE' : 'PAUSED'}
          </button>
          <button
            onClick={fetchActivity}
            className="p-1 rounded hover:bg-white/5 text-text-muted hover:text-text-secondary transition"
            title="Refresh"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Skip to Traders — centered CTA */}
      {skipToId && (
        <div className="px-4 py-2.5 border-b border-ep-border/30 flex justify-center">
          <button
            onClick={() => document.getElementById(skipToId)?.scrollIntoView({ behavior: 'smooth' })}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition flex items-center gap-1.5"
          >
            Skip to {skipToLabel}
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        </div>
      )}

      {/* Activity List */}
      {activity.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <div className="text-2xl mb-2">📡</div>
          <p className="text-sm text-text-muted">No trades detected in the last 24h</p>
          <p className="text-[10px] text-text-muted mt-1">The on-chain monitor is watching for activity...</p>
        </div>
      ) : (
        <div className={`divide-y divide-ep-border/30 ${compact ? 'max-h-[400px]' : 'max-h-[600px]'} overflow-y-auto`}>
          <AnimatePresence initial={false}>
            {activity.map((item, i) => (
              <motion.div
                key={item.id || `${item.traderId}-${item.timestamp}-${i}`}
                initial={i === 0 ? { opacity: 0, y: -10, backgroundColor: 'rgba(0,255,136,0.05)' } : { opacity: 1 }}
                animate={{ opacity: 1, y: 0, backgroundColor: 'transparent' }}
                transition={{ duration: 0.3 }}
                className="px-4 sm:px-5 py-3 hover:bg-white/[0.02] transition group"
              >
                <div className="flex items-start gap-3">
                  {/* Trader avatar */}
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                    style={{
                      backgroundColor: `${tierColors[item.traderTier] || '#8B92A8'}18`,
                      color: tierColors[item.traderTier] || '#8B92A8',
                    }}
                  >
                    {item.traderAlias[0]?.toUpperCase() || '?'}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Top row: trader + action + time */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-text-primary">{item.traderAlias}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        item.tradeType === 'exit'
                          ? 'bg-loss/15 text-loss'
                          : item.direction === 'YES'
                            ? 'bg-profit/15 text-profit'
                            : 'bg-loss/15 text-loss'
                      }`}>
                        {item.tradeType === 'exit' ? 'SOLD' : `BOUGHT ${item.direction}`}
                      </span>
                      <span className="text-[10px] text-text-muted ml-auto shrink-0">{timeAgo(item.timestamp)}</span>
                    </div>

                    {/* Market question + link */}
                    <div className="mt-1">
                      {item.polymarketUrl ? (
                        <a
                          href={item.polymarketUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-text-secondary hover:text-accent transition line-clamp-2 group-hover:text-accent"
                        >
                          {item.question}
                          <svg className="inline-block h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ) : (
                        <p className="text-xs text-text-secondary line-clamp-2">{item.question}</p>
                      )}
                    </div>

                    {/* Bottom row: amount, price, market info */}
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-text-muted">
                      <span className="font-mono font-semibold text-text-secondary">
                        {formatAmount(item.amount)}
                      </span>
                      {item.price > 0 && (
                        <span className="font-mono">
                          @ {(item.price * 100).toFixed(0)}%
                        </span>
                      )}
                      {item.traderTier && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] font-semibold"
                          style={{
                            color: tierColors[item.traderTier] || '#8B92A8',
                            background: `${tierColors[item.traderTier] || '#8B92A8'}15`,
                          }}
                        >
                          {item.traderTier.toUpperCase()}
                        </span>
                      )}
                      {item.polymarketUrl && (
                        <a
                          href={item.polymarketUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto text-accent/60 hover:text-accent transition font-semibold"
                        >
                          Trade on Polymarket &rarr;
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
