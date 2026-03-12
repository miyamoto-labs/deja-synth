'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { timeAgo } from '@/app/lib/utils/timeAgo';

interface Trade {
  id: string;
  side: string;
  direction: string;
  amount: number;
  price: number;
  shares: number;
  order_id: string;
  created_at: string;
  source: string | null;
  token_id?: string;
  market_question?: string | null;
  market_category?: string | null;
  realized_pnl?: number | null;
  resolved_at?: string | null;
}

interface CopyActivity {
  id: string;
  signal_id: string;
  trader_id: string;
  status: 'executed' | 'failed' | 'skipped';
  order_id?: string;
  amount?: number;
  market_slug?: string;
  market_question?: string;
  side?: string;
  direction?: string;
  price?: number;
  trader_alias?: string;
  error_message?: string;
  created_at: string;
}

type ActivityItem = {
  id: string;
  type: 'buy' | 'sell' | 'copy-executed' | 'copy-failed' | 'copy-skipped';
  marketQuestion: string;
  amount: number | null;
  price: number | null;
  direction: string | null;
  source: string | null;
  traderAlias: string | null;
  errorMessage: string | null;
  createdAt: string;
};

const TYPE_CONFIG: Record<ActivityItem['type'], { label: string; className: string }> = {
  'buy': { label: 'Buy', className: 'bg-emerald-500/20 text-emerald-400' },
  'sell': { label: 'Sell', className: 'bg-red-500/20 text-red-400' },
  'copy-executed': { label: 'Copy', className: 'bg-accent/15 text-accent' },
  'copy-failed': { label: 'Failed', className: 'bg-red-500/15 text-red-400' },
  'copy-skipped': { label: 'Skipped', className: 'bg-yellow-500/15 text-yellow-400' },
};

function sourceLabel(source: string | null): string {
  switch (source) {
    case 'pick': return 'AI Pick';
    case 'signal': return 'Copy Signal';
    case 'arcade': return 'Arcade';
    case 'polytinder': return 'PolyTinder';
    case 'standing-order': return 'Standing Order';
    case 'copy-trade': return 'Copy Trade';
    default: return source || 'Manual';
  }
}

interface ActivityTabProps {
  trades: Trade[];
  copyActivity: CopyActivity[];
  walletAddress?: string | null;
}

export function ActivityTab({ trades, copyActivity, walletAddress }: ActivityTabProps) {
  const polygonscanUrl = walletAddress
    ? `https://polygonscan.com/address/${walletAddress}`
    : null;

  const feed = useMemo(() => {
    // Filter out copytrade-sourced trades — they already appear as "Copy" entries
    // from copyActivity, so showing both creates confusing duplicates
    const tradeItems: ActivityItem[] = trades
      .filter((t) => t.source !== 'copytrade')
      .map((t) => ({
        id: `trade-${t.id || t.order_id}`,
        type: t.side === 'SELL' ? 'sell' : 'buy',
        marketQuestion: t.market_question || 'Unknown Market',
        amount: Number(t.amount),
        price: Number(t.price),
        direction: t.direction,
        source: t.source,
        traderAlias: null,
        errorMessage: null,
        createdAt: t.created_at,
      }));

    const copyItems: ActivityItem[] = copyActivity.map((c) => ({
      id: `copy-${c.id}`,
      type: c.status === 'executed'
        ? 'copy-executed'
        : c.status === 'failed'
        ? 'copy-failed'
        : 'copy-skipped',
      marketQuestion: c.market_question || c.market_slug || 'Unknown Market',
      amount: c.amount ?? null,
      price: c.price ?? null,
      direction: c.direction ?? null,
      source: 'copy-trade',
      traderAlias: c.trader_alias ?? null,
      errorMessage: c.error_message ?? null,
      createdAt: c.created_at,
    }));

    return [...tradeItems, ...copyItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [trades, copyActivity]);

  if (feed.length === 0) {
    return (
      <div className="ep-card p-8 text-center">
        <div className="text-2xl mb-2">📋</div>
        <p className="text-text-secondary text-sm">No activity yet</p>
        <p className="text-text-muted text-xs mt-1">
          Your trades and copy trade activity will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {feed.map((item, i) => {
        const cfg = TYPE_CONFIG[item.type];
        return (
          <motion.div
            key={item.id}
            className="ep-card p-3 sm:p-4"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.3) }}
          >
            <div className="flex items-center justify-between gap-3">
              {/* Left: type badge + market */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${cfg.className}`}>
                    {cfg.label}
                  </span>
                  <p className="text-sm font-medium text-text-primary leading-snug truncate">
                    {item.marketQuestion}
                  </p>
                </div>

                {/* Sub-line: direction, source, trader alias */}
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-text-muted">
                  {item.direction && (
                    <span className={`rounded px-1 py-0.5 text-[10px] font-bold ${
                      item.direction === 'YES'
                        ? 'bg-emerald-500/10 text-emerald-400/80'
                        : 'bg-red-500/10 text-red-400/80'
                    }`}>
                      {item.direction}
                    </span>
                  )}
                  {item.source && item.type.startsWith('copy') === false && (
                    <span>{sourceLabel(item.source)}</span>
                  )}
                  {item.traderAlias && (
                    <span>
                      via <span className="text-accent font-medium">{item.traderAlias}</span>
                    </span>
                  )}
                  {item.price != null && (
                    <span>@ {(item.price * 100).toFixed(1)}¢</span>
                  )}
                </div>

                {/* Error message for failed/skipped */}
                {item.errorMessage && (
                  <p className={`text-[11px] mt-1 leading-relaxed ${
                    item.type === 'copy-failed' ? 'text-red-400/70' : 'text-yellow-400/70'
                  }`}>
                    {item.errorMessage}
                  </p>
                )}
              </div>

              {/* Right: amount + time + polygonscan */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  {item.amount != null && (
                    <div className="font-mono text-sm font-bold text-text-primary">
                      ${item.amount.toFixed(2)}
                    </div>
                  )}
                  <div className="text-[11px] text-text-muted">
                    {timeAgo(item.createdAt)}
                  </div>
                </div>
                {polygonscanUrl && (
                  <a
                    href={polygonscanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-text-muted hover:text-accent transition"
                    title="View on Polygonscan"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
