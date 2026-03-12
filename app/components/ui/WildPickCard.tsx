'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DirectionBadge, StatusBadge } from './Badges';
import { PickTierBadge } from './PickTierBadge';
import { ActionButton } from './ActionButton';
import { useTradePanel } from './TradePanel';

interface WildPickCardProps {
  pick: any;
  className?: string;
}

function fmtPrice(p: number) {
  if (p > 1) return `${p.toFixed(0)}`;
  const cents = p * 100;
  return cents > 95 || cents < 5 ? `${cents.toFixed(1)}` : `${cents.toFixed(0)}`;
}

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function WildPickCard({ pick, className = '' }: WildPickCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { openTrade } = useTradePanel();
  const market = pick.market;
  const questionText = pick.question || market?.question || pick.market_id;

  const handleBet = (side: 'YES' | 'NO') => {
    openTrade({
      type: 'pick',
      pick: {
        id: pick.id,
        market_id: pick.market_id,
        direction: pick.direction,
        conviction_score: pick.conviction_score,
        entry_price: pick.entry_price,
        target_price: pick.target_price,
        stop_loss: pick.stop_loss,
        risk_reward: pick.risk_reward,
        edge_explanation: pick.edge_explanation,
        market: {
          question: questionText,
          yes_price: pick.price || pick.entry_price || market?.yes_price || 0,
          no_price: market?.no_price || (1 - (pick.price || pick.entry_price || 0.5)),
          yes_token: pick.token_id || market?.yes_token || '',
          no_token: market?.no_token || '',
        },
      },
      side,
    });
  };

  return (
    <motion.div
      className={`relative overflow-hidden rounded-xl cursor-pointer ${className}`}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Wild card special border */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/20 via-pink-500/15 to-orange-500/20 blur-[1px]" />

      <div className="relative bg-ep-card/95 rounded-xl border border-purple-500/20 p-4">
        {/* Wild indicator */}
        <div className="absolute top-2 right-2">
          <span className="text-lg" title="Wild Pick">🎲</span>
        </div>

        <div className="flex items-start gap-3 pr-8">
          {/* Conviction pill */}
          <span className="text-xs font-bold px-2 py-1 rounded-lg border shrink-0 bg-purple-500/15 text-purple-400 border-purple-500/20">
            {pick.conviction_score}%
          </span>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary line-clamp-2">
              {questionText}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <DirectionBadge direction={pick.direction} />
              <StatusBadge status={pick.status} />
              {pick.tier && <PickTierBadge tier={pick.tier} size="sm" showLabel={false} />}
              <span className="text-[11px] text-text-muted">
                Buy {pick.direction} at {fmtPrice(pick.entry_price)}¢ → {fmtPrice(pick.target_price)}¢
              </span>
            </div>
          </div>
        </div>

        {/* Risk warning */}
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-purple-400/70">
          <span>⚡</span>
          <span>High volatility · {pick.risk_reward?.toFixed(1)}x R/R · {timeAgo(pick.created_at)}</span>
        </div>

        {/* Expandable action row */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3 mt-3 border-t border-purple-500/15 space-y-2">
                {pick.edge_explanation && (
                  <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
                    {pick.edge_explanation}
                  </p>
                )}
                <div className="flex gap-2">
                  <ActionButton
                    variant={pick.direction === 'YES' ? 'yes' : 'no'}
                    size="sm"
                    fullWidth
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleBet(pick.direction as 'YES' | 'NO'); }}
                  >
                    🎲 Bet {pick.direction}
                  </ActionButton>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleBet(pick.direction === 'YES' ? 'NO' : 'YES'); }}
                    className="btn-ghost px-3 py-2 text-xs shrink-0"
                  >
                    or {pick.direction === 'YES' ? 'NO' : 'YES'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
