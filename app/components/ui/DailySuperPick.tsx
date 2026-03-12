'use client';

import { motion } from 'framer-motion';
import { ConvictionGauge } from './ConvictionGauge';
import { DirectionBadge } from './Badges';
import { ActionButton } from './ActionButton';
import { PickTierBadge } from './PickTierBadge';
import { useTradePanel } from './TradePanel';

interface SuperPickProps {
  pick: any;
}

function fmtPrice(p: number) {
  if (p > 1) return `${p.toFixed(0)}`;
  const cents = p * 100;
  return cents > 95 || cents < 5 ? `${cents.toFixed(1)}` : `${cents.toFixed(0)}`;
}

function getEdgePercent(pick: any): string {
  if (!pick.entry_price || !pick.target_price) return '—';
  const edge = Math.abs(pick.target_price - pick.entry_price) / pick.entry_price * 100;
  return `+${edge.toFixed(0)}%`;
}

function getConfidenceLabel(score: number): string {
  if (score >= 85) return 'VERY HIGH';
  if (score >= 75) return 'HIGH';
  if (score >= 65) return 'MODERATE';
  return 'LOW';
}

export function DailySuperPick({ pick }: SuperPickProps) {
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
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl"
    >
      {/* Gradient border glow */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/30 via-yellow-500/20 to-red-500/20 blur-sm" />

      <div className="relative bg-ep-card/95 backdrop-blur-sm rounded-2xl border border-accent/20 overflow-hidden">
        {/* Top banner */}
        <div className="bg-gradient-to-r from-accent/15 via-yellow-500/10 to-transparent px-5 py-3 flex items-center gap-3">
          <span className="text-2xl">🔥</span>
          <div>
            <h2 className="font-display text-sm sm:text-base font-bold text-accent uppercase tracking-wider">
              Daily Super Pick
            </h2>
            <p className="text-[10px] text-text-muted">
              Highest conviction pick today
            </p>
          </div>
          {pick.tier && (
            <div className="ml-auto">
              <PickTierBadge tier={pick.tier} size="lg" />
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            {/* Left: Content */}
            <div className="flex-1 min-w-0">
              {/* Market question */}
              <h3 className="font-display text-lg sm:text-xl font-bold text-text-primary leading-tight">
                {questionText}
              </h3>

              {/* Summary */}
              {pick.telegram_summary && (
                <p className="text-sm text-text-secondary mt-2 line-clamp-2">
                  {pick.telegram_summary}
                </p>
              )}

              {/* Direction + Plain English */}
              <div className="flex items-center gap-2 mt-3">
                <DirectionBadge direction={pick.direction} />
                <span className="text-sm text-accent font-medium">
                  Buy {pick.direction} at {fmtPrice(pick.entry_price)}¢ → target {fmtPrice(pick.target_price)}¢
                </span>
              </div>
            </div>

            {/* Right: Conviction gauge */}
            <div className="shrink-0">
              <ConvictionGauge score={pick.conviction_score} size="lg" />
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="bg-ep-surface/60 rounded-xl p-3 text-center border border-ep-border/50">
              <div className="text-[10px] text-text-muted uppercase tracking-wider">Confidence</div>
              <div className="font-display text-sm font-bold text-accent mt-0.5">
                {getConfidenceLabel(pick.conviction_score)}
              </div>
            </div>
            <div className="bg-ep-surface/60 rounded-xl p-3 text-center border border-ep-border/50">
              <div className="text-[10px] text-text-muted uppercase tracking-wider">Edge</div>
              <div className="font-display text-sm font-bold text-profit mt-0.5">
                {getEdgePercent(pick)}
              </div>
            </div>
            <div className="bg-ep-surface/60 rounded-xl p-3 text-center border border-ep-border/50">
              <div className="text-[10px] text-text-muted uppercase tracking-wider">R/R</div>
              <div className="font-display text-sm font-bold text-yellow-400 mt-0.5">
                {pick.risk_reward?.toFixed(1)}x
              </div>
            </div>
          </div>

          {/* Edge explanation */}
          {pick.edge_explanation && (
            <div className="mt-4 p-3 rounded-xl bg-accent/5 border border-accent/10">
              <p className="text-xs font-medium text-accent mb-1">💡 Why this pick?</p>
              <p className="text-sm text-text-secondary leading-relaxed line-clamp-3">
                {pick.edge_explanation}
              </p>
            </div>
          )}

          {/* CTA */}
          <div className="flex gap-3 mt-5">
            <ActionButton
              variant={pick.direction === 'YES' ? 'yes' : 'no'}
              size="md"
              fullWidth
              onClick={() => handleBet(pick.direction as 'YES' | 'NO')}
            >
              🔥 Bet {pick.direction} at {fmtPrice(pick.entry_price)}¢
            </ActionButton>
            <button
              onClick={() => handleBet(pick.direction === 'YES' ? 'NO' : 'YES')}
              className="px-4 py-2 text-xs font-medium text-text-muted hover:text-text-secondary
                         border border-ep-border rounded-xl hover:border-ep-border/80 transition shrink-0"
            >
              or {pick.direction === 'YES' ? 'NO' : 'YES'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/** Loading skeleton for Daily Super Pick */
export function DailySuperPickSkeleton() {
  return (
    <div className="rounded-2xl border border-ep-border/50 bg-ep-card overflow-hidden">
      <div className="bg-ep-surface/30 px-5 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full skeleton" />
        <div className="space-y-1">
          <div className="h-4 w-36 skeleton rounded" />
          <div className="h-3 w-48 skeleton rounded" />
        </div>
      </div>
      <div className="p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="flex-1 space-y-2">
            <div className="h-6 w-3/4 skeleton rounded" />
            <div className="h-4 w-1/2 skeleton rounded" />
            <div className="h-4 w-1/3 skeleton rounded" />
          </div>
          <div className="w-[100px] h-[100px] skeleton rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="h-16 skeleton rounded-xl" />
          <div className="h-16 skeleton rounded-xl" />
          <div className="h-16 skeleton rounded-xl" />
        </div>
        <div className="h-10 skeleton rounded-xl" />
      </div>
    </div>
  );
}
