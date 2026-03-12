'use client';

import { useRef, useState, useEffect } from 'react';
import { CategoryBadge } from './Badges';
import { ActionButton } from './ActionButton';
import { useTradePanel } from './TradePanel';
import { useMarketDetail } from './MarketDetailDrawer';
import { MiniSparkline, MiniSparklineSkeleton } from './MiniSparkline';
import { useSparklineData } from '@/app/lib/hooks/useSparklineData';
import { CATEGORY_COLORS } from '@/app/dashboard/markets/constants';

interface MarketOutcome {
  label: string;
  yes_price: number;
  market_id: string;
  yes_token: string;
  no_token: string;
  volume: number;
}

interface Market {
  market_id: string;
  condition_id?: string;
  question: string;
  category: string;
  subcategory?: string;
  is_multi?: boolean;
  yes_price: number;
  no_price: number;
  yes_token: string;
  no_token: string;
  yes_label?: string;
  no_label?: string;
  outcomes?: MarketOutcome[];
  outcome_count?: number;
  volume: number;
  volume_24h?: number;
  liquidity: number;
  end_date: string;
  hotness?: number;
  staff_pick?: { direction: string; tier: string };
}

const HOT_THRESHOLD = 5;
const FIRE_THRESHOLD = 8;

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function timeRemaining(endDate: string): string {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / 86_400_000);
  if (days > 30) return `${Math.floor(days / 30)}mo left`;
  if (days > 0) return `${days}d left`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours > 0) return `${hours}h left`;
  return '<1h left';
}

// ── Outcome bar colors (cycle for multi-choice) ──
const OUTCOME_COLORS = [
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#F59E0B', // amber
  '#10B981', // emerald
  '#EC4899', // pink
  '#6366F1', // indigo
];

function usePriceFlash(price: number): string {
  const prev = useRef(price);
  const [flash, setFlash] = useState('');
  useEffect(() => {
    if (prev.current === price) return;
    setFlash(price > prev.current ? 'animate-tick-up' : 'animate-tick-down');
    prev.current = price;
    const t = setTimeout(() => setFlash(''), 600);
    return () => clearTimeout(t);
  }, [price]);
  return flash;
}

export function MarketCard({ market }: { market: Market }) {
  const { openTrade } = useTradePanel();
  const { openDetail } = useMarketDetail();
  const cardRef = useRef<HTMLDivElement>(null);
  const { data: sparklineData, loading: sparklineLoading } = useSparklineData(
    market.yes_token,
    cardRef
  );

  const handleBet = (side: 'YES' | 'NO', outcome?: MarketOutcome) => {
    openTrade({
      type: 'market',
      side,
      market: {
        market_id: outcome?.market_id || market.market_id,
        question: outcome ? `${market.question} → ${outcome.label}` : market.question,
        yes_price: outcome?.yes_price ?? market.yes_price,
        no_price: outcome ? 1 - outcome.yes_price : market.no_price,
        yes_token: outcome?.yes_token || market.yes_token || '',
        no_token: outcome?.no_token || market.no_token || '',
        // Pass all outcomes so the trade panel can show alternatives
        outcomes: isMulti && market.outcomes ? market.outcomes.map((o) => ({
          label: o.label,
          yes_price: o.yes_price,
          market_id: o.market_id,
          yes_token: o.yes_token,
          no_token: o.no_token,
        })) : undefined,
      },
    });
  };

  const yesFlash = usePriceFlash(market.yes_price);

  const hotness = market.hotness ?? 0;
  const isFire = hotness >= FIRE_THRESHOLD;
  const isHot = hotness >= HOT_THRESHOLD;
  const catColor = CATEGORY_COLORS[market.category] || '#8B92A8';

  const isMulti = market.is_multi && market.outcomes && market.outcomes.length > 1;

  return (
    <div ref={cardRef} className={`ep-card p-3 sm:p-4 flex flex-col gap-3 transition-colors relative overflow-hidden ${
      isFire
        ? 'border-orange-500/30 hover:border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.08)]'
        : isHot
          ? 'border-amber-500/20 hover:border-amber-500/40'
          : 'hover:border-ep-border'
    }`}>
      {/* Category-colored left accent */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: `${catColor}50` }}
      />

      {isFire && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-orange-500/60 via-amber-400/80 to-orange-500/60" />
      )}

      {/* Top row: category + badges + time */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <CategoryBadge category={market.category || 'other'} />
          {isMulti && (
            <span className="badge text-[10px] font-bold" style={{
              color: '#8B5CF6',
              background: 'rgba(139, 92, 246, 0.12)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
            }}>
              {market.outcome_count} choices
            </span>
          )}
          {isFire ? (
            <span className="badge text-[10px] font-bold" style={{
              color: '#F97316',
              background: 'rgba(249, 115, 22, 0.15)',
              border: '1px solid rgba(249, 115, 22, 0.25)',
            }}>
              🔥 HOT
            </span>
          ) : isHot ? (
            <span className="badge text-[10px] font-bold" style={{
              color: '#F59E0B',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
            }}>
              🔥
            </span>
          ) : null}
          {market.staff_pick && (
            <span className="badge text-[10px] font-bold" style={{
              color: '#A78BFA',
              background: 'rgba(167, 139, 250, 0.12)',
              border: '1px solid rgba(167, 139, 250, 0.2)',
            }}>
              ✦ AI Pick · {market.staff_pick.direction}
            </span>
          )}
        </div>
        {market.end_date && (
          <span className="text-[10px] font-mono text-text-muted">
            {timeRemaining(market.end_date)}
          </span>
        )}
      </div>

      {/* Question — click to open detail drawer */}
      <h3
        className="font-display text-sm font-semibold text-text-primary leading-snug line-clamp-2 min-h-[2.5rem] cursor-pointer hover:text-accent transition-colors"
        onClick={() => openDetail(market)}
      >
        {market.question}
      </h3>

      {isMulti ? (
        <>
          {/* Multi-choice outcomes */}
          <div className="space-y-1.5">
            {market.outcomes!.slice(0, 4).map((o, i) => {
              const pct = Math.round(o.yes_price * 100);
              const color = OUTCOME_COLORS[i % OUTCOME_COLORS.length];
              return (
                <button
                  key={o.market_id}
                  onClick={() => handleBet('YES', o)}
                  className="w-full flex items-center gap-2 group"
                >
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <div
                      className="h-5 rounded-md flex-shrink-0 transition-all group-hover:opacity-80"
                      style={{
                        width: `${Math.max(pct, 3)}%`,
                        background: `${color}30`,
                        border: `1px solid ${color}40`,
                      }}
                    />
                    <span className="text-xs text-text-secondary truncate flex-shrink min-w-0">
                      {o.label}
                    </span>
                  </div>
                  <span
                    className="text-xs font-mono font-semibold flex-shrink-0"
                    style={{ color }}
                  >
                    {pct}%
                  </span>
                </button>
              );
            })}
            {(market.outcome_count ?? 0) > 4 && (
              <span className="text-[10px] text-text-muted pl-1">
                +{(market.outcome_count ?? 0) - 4} more
              </span>
            )}
          </div>

          {/* Volume + Liquidity */}
          <div className="flex items-center gap-3 text-xs mt-auto">
            <div className="flex items-center gap-1">
              <span className="text-text-muted">Vol</span>
              <span className="font-mono font-semibold text-text-secondary">
                {formatVolume(market.volume || 0)}
              </span>
            </div>
            {market.volume_24h ? (
              <div className="flex items-center gap-1">
                <span className="text-text-muted">24h</span>
                <span className="font-mono font-semibold text-text-secondary">
                  {formatVolume(market.volume_24h)}
                </span>
              </div>
            ) : null}
            <div className="ml-auto flex items-center gap-1">
              <span className="text-text-muted">Liq</span>
              <span className="font-mono font-semibold text-text-secondary">
                {formatVolume(market.liquidity || 0)}
              </span>
            </div>
          </div>

          {/* Sparkline (leading outcome trend) */}
          {sparklineData ? (
            <MiniSparkline data={sparklineData} height={32} />
          ) : sparklineLoading ? (
            <MiniSparklineSkeleton height={32} />
          ) : null}
        </>
      ) : (
        <>
          {/* Binary: Prices */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-text-muted">{market.yes_label || 'YES'}</span>
              <span className={`font-mono font-semibold text-profit ${yesFlash}`}>
                {(market.yes_price * 100).toFixed(0)}¢
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-text-muted">{market.no_label || 'NO'}</span>
              <span className={`font-mono font-semibold text-loss ${yesFlash ? (yesFlash === 'animate-tick-up' ? 'animate-tick-down' : 'animate-tick-up') : ''}`}>
                {(market.no_price * 100).toFixed(0)}¢
              </span>
            </div>
          </div>

          {/* Volume + Liquidity */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-text-muted">Vol</span>
              <span className="font-mono font-semibold text-text-secondary">
                {formatVolume(market.volume || 0)}
              </span>
            </div>
            {market.volume_24h ? (
              <div className="flex items-center gap-1">
                <span className="text-text-muted">24h</span>
                <span className="font-mono font-semibold text-text-secondary">
                  {formatVolume(market.volume_24h)}
                </span>
              </div>
            ) : null}
            <div className="ml-auto flex items-center gap-1">
              <span className="text-text-muted">Liq</span>
              <span className="font-mono font-semibold text-text-secondary">
                {formatVolume(market.liquidity || 0)}
              </span>
            </div>
          </div>

          {/* Sparkline (24h price trend) */}
          {sparklineData ? (
            <MiniSparkline data={sparklineData} height={32} />
          ) : sparklineLoading ? (
            <MiniSparklineSkeleton height={32} />
          ) : null}

          {/* Probability bar */}
          <div className="w-full h-1 rounded-full bg-ep-surface/60 overflow-hidden flex">
            <div
              className="h-full rounded-l-full"
              style={{
                width: `${market.yes_price * 100}%`,
                background: 'var(--color-profit, #00F0A0)',
              }}
            />
            <div
              className="h-full rounded-r-full"
              style={{
                width: `${market.no_price * 100}%`,
                background: 'var(--color-loss, #FF4060)',
              }}
            />
          </div>

          {/* Trade buttons */}
          <div className="flex gap-2 mt-auto">
            <ActionButton variant="yes" size="sm" fullWidth onClick={() => handleBet('YES')}>
              Bet {market.yes_label || 'YES'}
            </ActionButton>
            <ActionButton variant="no" size="sm" fullWidth onClick={() => handleBet('NO')}>
              Bet {market.no_label || 'NO'}
            </ActionButton>
          </div>
        </>
      )}
    </div>
  );
}

export function MarketCardSkeleton() {
  return (
    <div className="ep-card p-4 flex flex-col gap-3 animate-pulse">
      <div className="flex justify-between">
        <div className="h-5 w-16 rounded bg-ep-surface/60" />
        <div className="h-4 w-12 rounded bg-ep-surface/60" />
      </div>
      <div className="space-y-1.5">
        <div className="h-4 w-full rounded bg-ep-surface/60" />
        <div className="h-4 w-2/3 rounded bg-ep-surface/60" />
      </div>
      <div className="flex gap-3">
        <div className="h-4 w-12 rounded bg-ep-surface/60" />
        <div className="h-4 w-12 rounded bg-ep-surface/60" />
        <div className="ml-auto h-4 w-14 rounded bg-ep-surface/60" />
      </div>
      <div className="flex gap-2">
        <div className="h-8 flex-1 rounded-[10px] bg-ep-surface/60" />
        <div className="h-8 flex-1 rounded-[10px] bg-ep-surface/60" />
      </div>
    </div>
  );
}
