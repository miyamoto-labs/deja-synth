'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TierBadge, StyleBadge } from './Badges';

interface RisingStar {
  id: string;
  alias: string;
  wallet_address: string;
  roi: number;
  win_rate: number;
  trade_count: number;
  total_pnl: number;
  bankroll_tier: string;
  trading_style: string;
  markets_traded: number;
  star_score: number;
}

function formatPnl(val: number): string {
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

function getStarEmoji(rank: number): string {
  if (rank === 1) return '\u{1F31F}'; // glowing star
  if (rank === 2) return '\u{2B50}'; // star
  if (rank === 3) return '\u{2728}'; // sparkles
  return '\u{1F4AB}'; // dizzy star
}

export function RisingStars() {
  const [stars, setStars] = useState<RisingStar[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchStars = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/rising-stars?limit=10');
      const data = await res.json();
      setStars(data.stars || []);
      setStats({
        total: data.total,
        avgRoi: data.avg_roi,
        avgWinRate: data.avg_win_rate,
        filteredBots: data.filtered_bots,
      });
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStars();
    const interval = setInterval(fetchStars, 120000); // refresh every 2min
    return () => clearInterval(interval);
  }, [fetchStars]);

  const visibleStars = expanded ? stars : stars.slice(0, 5);

  if (loading) {
    return (
      <div className="ep-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">{'\u{1F320}'}</span>
          <div className="h-4 w-40 bg-surface-2 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 bg-surface-2 rounded-full animate-pulse" />
              <div className="h-4 flex-1 bg-surface-2 rounded animate-pulse" />
              <div className="h-4 w-16 bg-surface-2 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (stars.length === 0) return null;

  return (
    <motion.div
      className="ep-card p-4 sm:p-5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">{'\u{1F320}'}</span>
          <h2 className="font-display text-sm sm:text-base font-semibold">Rising Stars</h2>
        </div>
        {stats?.filteredBots > 0 && (
          <span className="text-[10px] text-text-muted bg-surface-2 px-2 py-0.5 rounded-full">
            {'\u{1F916}'} {stats.filteredBots} bots filtered
          </span>
        )}
      </div>
      <p className="text-[11px] text-text-muted mb-4">
        Small bankroll traders with exceptional performance
      </p>

      {/* Stats summary */}
      {stats && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-surface-2/50 rounded-lg p-2 text-center">
            <div className="text-xs text-text-muted">Avg ROI</div>
            <div className="font-mono text-sm font-bold text-profit">
              +{stats.avgRoi}%
            </div>
          </div>
          <div className="bg-surface-2/50 rounded-lg p-2 text-center">
            <div className="text-xs text-text-muted">Avg Win Rate</div>
            <div className="font-mono text-sm font-bold text-text-primary">
              {stats.avgWinRate}%
            </div>
          </div>
        </div>
      )}

      {/* Star list */}
      <div className="space-y-1">
        <AnimatePresence mode="popLayout">
          {visibleStars.map((star, i) => {
            const roiColor = star.roi > 0 ? '#00F0A0' : '#FF4060';
            return (
              <motion.div
                key={star.id}
                className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-surface-2 transition-colors group"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: i * 0.04 }}
              >
                {/* Rank with star emoji */}
                <span className="text-sm w-6 text-center shrink-0">
                  {getStarEmoji(i + 1)}
                </span>

                {/* Avatar */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{
                    background: `${roiColor}15`,
                    color: roiColor,
                    border: `1.5px solid ${roiColor}30`,
                  }}
                >
                  {(star.alias || '?')[0]?.toUpperCase()}
                </div>

                {/* Name + badges */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-text-primary truncate">
                      {star.alias || star.wallet_address?.slice(0, 10)}
                    </span>
                    <TierBadge tier={star.bankroll_tier} />
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-text-muted mt-0.5">
                    <span>{star.trade_count} trades</span>
                    <span>{'\u{00B7}'}</span>
                    <span>{star.markets_traded} markets</span>
                  </div>
                </div>

                {/* Win rate */}
                <div className="text-right shrink-0">
                  <div className="font-mono text-xs text-text-secondary">
                    {star.win_rate.toFixed(0)}% WR
                  </div>
                </div>

                {/* ROI */}
                <div className="text-right shrink-0 w-16">
                  <div
                    className="font-mono text-sm font-bold"
                    style={{ color: roiColor }}
                  >
                    +{star.roi.toFixed(0)}%
                  </div>
                  <div className="text-[10px] text-text-muted">
                    {formatPnl(star.total_pnl)}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Show more / less */}
      {stars.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-3 py-2 text-xs text-accent hover:text-accent/80 transition-colors text-center"
        >
          {expanded ? 'Show less \u25B4' : `Show all ${stars.length} stars \u25BE`}
        </button>
      )}

      {/* View all traders link */}
      <div className="mt-3 pt-3 border-t border-ep-border">
        <a
          href="/dashboard/traders"
          className="flex items-center justify-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors"
        >
          View all traders {'\u{2192}'}
        </a>
      </div>
    </motion.div>
  );
}
