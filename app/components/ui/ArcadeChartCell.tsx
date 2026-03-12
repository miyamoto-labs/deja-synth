'use client';

import { useState, useEffect, useRef } from 'react';
import { MiniRaceView } from './MiniRaceView';
import type { FrameData } from './snake-game/types';
import type { PricePoint } from '@/app/lib/hooks/useBinancePrice';

/* ── Types ──────────────────────────────────────── */
interface ActiveBet {
  id: string;
  side: 'UP' | 'DOWN';
  entryPrice: number;
  amount: number;
  shares: number;
  market: string;
  slug: string;
  marketEndTime: number;
  status: 'live' | 'resolving' | 'resolved';
  tokenId?: string;
  result?: { outcome: 'won' | 'lost' | 'push'; pnl: number };
}

interface ArcadeChartCellProps {
  asset: 'btcusdt' | 'ethusdt';
  windowLabel: string; // e.g. "Current" or "Next"
  windowTimeRange: string; // e.g. "14:30 - 14:35 UTC"
  pricesRef: React.MutableRefObject<PricePoint[]>;
  latestPriceRef: React.MutableRefObject<{ price: number; time: number }>;
  smoothPriceRef: React.MutableRefObject<{ price: number; time: number }>;
  currentPrice: number;
  connected: boolean;
  activeBet: ActiveBet | null;
  canPlaceBet: boolean;
  clicking: boolean;
  betAmount: number;
  yesPrice: number | null;
  noPrice: number | null;
  onClickBet: (side: 'UP' | 'DOWN') => void;
  onSellBet?: (bet: ActiveBet) => void;
  onFrameData?: (data: FrameData) => void;
}

/* ── Countdown helper ── */
function useCountdown(endTime: number | null) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (!endTime) { setText(''); return; }

    const tick = () => {
      const ms = endTime - Date.now();
      if (ms <= 0) { setText('Resolving...'); return; }
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setText(`${m}:${s.toString().padStart(2, '0')}`);
    };

    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [endTime]);

  return text;
}

/* ── Component ─────────────────────────────────── */
export function ArcadeChartCell({
  asset,
  windowLabel,
  windowTimeRange,
  pricesRef,
  latestPriceRef,
  smoothPriceRef,
  currentPrice,
  connected,
  activeBet,
  canPlaceBet,
  clicking,
  betAmount,
  yesPrice,
  noPrice,
  onClickBet,
  onSellBet,
  onFrameData,
}: ArcadeChartCellProps) {
  const assetLabel = asset === 'btcusdt' ? 'BTC' : 'ETH';
  const countdown = useCountdown(activeBet?.marketEndTime ?? null);

  const activeBetForChart = activeBet
    ? {
        side: activeBet.side,
        entryPrice: activeBet.entryPrice,
        amount: activeBet.amount,
        shares: activeBet.shares,
        market: activeBet.market,
        marketEndTime: activeBet.marketEndTime,
      }
    : null;

  const hasBet = !!activeBet && activeBet.status === 'live';
  const isResolving = activeBet?.status === 'resolving';
  const isResolved = activeBet?.status === 'resolved';

  const borderClass = hasBet
    ? activeBet.side === 'UP'
      ? 'border-profit/40'
      : 'border-loss/40'
    : isResolving
      ? 'border-conviction-medium/40'
      : isResolved
        ? activeBet?.result?.outcome === 'won'
          ? 'border-profit/60'
          : 'border-loss/60'
        : 'border-ep-border';

  return (
    <div className={`ep-card overflow-hidden border-2 ${borderClass} transition-colors duration-300`}>
      {/* ── Label Bar ── */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-ep-border bg-ep-surface/50">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider">
            {assetLabel} 5m
          </span>
          <span className="text-[9px] text-accent font-semibold">{windowLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          {countdown && hasBet && (
            <span className="text-[9px] font-mono text-conviction-medium">{countdown}</span>
          )}
          <span className="text-[9px] text-text-muted font-mono">{windowTimeRange}</span>
          {connected && (
            <span className="w-1.5 h-1.5 rounded-full bg-profit animate-pulse" />
          )}
        </div>
      </div>

      {/* ── Chart ── */}
      <MiniRaceView
        pricesRef={pricesRef}
        latestPriceRef={latestPriceRef}
        smoothPriceRef={smoothPriceRef}
        currentPrice={currentPrice}
        connected={connected}
        activeBet={activeBetForChart}
        onFrameData={onFrameData}
      />

      {/* ── Active Bet Overlay ── */}
      {activeBet && (
        <div className="px-3 py-1.5 border-t border-ep-border bg-ep-surface/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                activeBet.side === 'UP' ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'
              }`}>
                {activeBet.side}
              </span>
              <span className="text-[10px] text-text-muted font-mono">
                ${activeBet.amount.toFixed(2)} @ {(activeBet.entryPrice * 100).toFixed(0)}c
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isResolving && (
                <span className="text-[9px] text-conviction-medium animate-pulse">Resolving...</span>
              )}
              {isResolved && activeBet.result && (
                <span className={`text-[10px] font-mono font-bold ${
                  activeBet.result.outcome === 'won' ? 'text-profit' : 'text-loss'
                }`}>
                  {activeBet.result.pnl >= 0 ? '+' : ''}{activeBet.result.pnl.toFixed(2)}
                </span>
              )}
              {hasBet && onSellBet && (
                <button
                  onClick={() => onSellBet(activeBet)}
                  className="text-[9px] px-2 py-0.5 rounded bg-conviction-medium/10 text-conviction-medium border border-conviction-medium/20 hover:bg-conviction-medium/20 transition font-semibold"
                >
                  SELL
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Price + Buttons ── */}
      <div className="px-3 py-2 border-t border-ep-border">
        {/* Odds row */}
        {yesPrice !== null && noPrice !== null && (
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="text-[10px] text-profit font-mono">
              UP {(yesPrice * 100).toFixed(0)}c
            </span>
            <span className="text-[9px] text-text-muted">/</span>
            <span className="text-[10px] text-loss font-mono">
              DOWN {(noPrice * 100).toFixed(0)}c
            </span>
          </div>
        )}

        {/* UP / DOWN buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onClickBet('UP')}
            disabled={!canPlaceBet || clicking}
            className={`relative py-2.5 rounded-xl font-bold text-xs transition-all ${
              canPlaceBet && !clicking
                ? 'bg-profit/10 text-profit border border-profit/30 hover:bg-profit/20 active:scale-95'
                : 'bg-ep-surface text-text-muted border border-ep-border cursor-not-allowed opacity-50'
            }`}
          >
            <div className="flex items-center justify-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
              </svg>
              <span>UP ${betAmount}</span>
            </div>
            {clicking && (
              <div className="absolute inset-0 flex items-center justify-center bg-ep-bg/50 rounded-xl">
                <div className="w-4 h-4 border-2 border-profit/30 border-t-profit rounded-full animate-spin" />
              </div>
            )}
          </button>
          <button
            onClick={() => onClickBet('DOWN')}
            disabled={!canPlaceBet || clicking}
            className={`relative py-2.5 rounded-xl font-bold text-xs transition-all ${
              canPlaceBet && !clicking
                ? 'bg-loss/10 text-loss border border-loss/30 hover:bg-loss/20 active:scale-95'
                : 'bg-ep-surface text-text-muted border border-ep-border cursor-not-allowed opacity-50'
            }`}
          >
            <div className="flex items-center justify-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
              <span>DOWN ${betAmount}</span>
            </div>
            {clicking && (
              <div className="absolute inset-0 flex items-center justify-center bg-ep-bg/50 rounded-xl">
                <div className="w-4 h-4 border-2 border-loss/30 border-t-loss rounded-full animate-spin" />
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
