'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface HotMarket {
  market_id: string;
  question: string;
  yes_price: number;
  volume: number;
  category: string;
}

function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `$${(vol / 1_000).toFixed(0)}K`;
  return `$${vol.toFixed(0)}`;
}

function categoryEmoji(cat: string): string {
  const map: Record<string, string> = {
    politics: '\u{1F3DB}',
    crypto: '\u{1F4B0}',
    sports: '\u{26BD}',
    science: '\u{1F52C}',
    pop_culture: '\u{1F3AC}',
    business: '\u{1F4C8}',
    finance: '\u{1F4B5}',
    world: '\u{1F30D}',
    tech: '\u{1F4BB}',
  };
  return map[cat?.toLowerCase()] || '\u{1F525}';
}

function truncateQuestion(q: string, max = 60): string {
  if (q.length <= max) return q;
  return q.slice(0, max).trim() + '...';
}

export function HotMarkets() {
  const [markets, setMarkets] = useState<HotMarket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMarkets = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/markets');
      const data = await res.json();
      setMarkets(data.hot_markets || data.top_markets || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, 60000); // refresh every 60s
    return () => clearInterval(interval);
  }, [fetchMarkets]);

  if (loading) {
    return (
      <div className="ep-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">{'\u{1F525}'}</span>
          <div className="h-4 w-32 bg-surface-2 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-4 bg-surface-2 rounded animate-pulse" />
              <div className="h-4 flex-1 bg-surface-2 rounded animate-pulse" />
              <div className="h-4 w-16 bg-surface-2 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (markets.length === 0) return null;

  return (
    <motion.div
      className="ep-card p-4 sm:p-5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">{'\u{1F525}'}</span>
          <h2 className="font-display text-sm sm:text-base font-semibold">Hot Markets</h2>
          <span className="text-xs text-text-muted">by volume</span>
        </div>
        <span className="text-[10px] text-text-muted uppercase tracking-wider">Top {markets.length}</span>
      </div>

      <div className="space-y-1">
        <AnimatePresence mode="popLayout">
          {markets.map((m, i) => (
            <motion.a
              key={m.market_id}
              href={`https://polymarket.com/event/${m.market_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-surface-2 transition-colors group cursor-pointer"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: i * 0.03 }}
            >
              {/* Rank */}
              <span className={`text-xs font-mono w-5 text-center shrink-0 ${
                i < 3 ? 'text-accent font-bold' : 'text-text-muted'
              }`}>
                {i + 1}
              </span>

              {/* Category emoji */}
              <span className="text-sm shrink-0">{categoryEmoji(m.category)}</span>

              {/* Question */}
              <span className="text-sm text-text-primary group-hover:text-white transition-colors flex-1 min-w-0 truncate">
                {truncateQuestion(m.question)}
              </span>

              {/* Yes price */}
              <span className={`text-xs font-mono shrink-0 px-1.5 py-0.5 rounded ${
                m.yes_price >= 0.7
                  ? 'text-profit bg-profit/10'
                  : m.yes_price <= 0.3
                  ? 'text-loss bg-loss/10'
                  : 'text-text-secondary bg-surface-2'
              }`}>
                {(m.yes_price * 100).toFixed(0)}{'\u{00A2}'}
              </span>

              {/* Volume */}
              <span className="text-xs text-text-muted font-mono shrink-0 w-16 text-right">
                {formatVolume(m.volume)}
              </span>
            </motion.a>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
