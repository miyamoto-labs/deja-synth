'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { SynthMarketData } from '@/app/lib/hooks/useSynthMarkets';
import type { PricePoint } from '@/app/lib/hooks/useBinancePrice';
import dynamic from 'next/dynamic';

const MiniRaceView = dynamic(
  () => import('@/app/components/ui/MiniRaceView').then((m) => m.MiniRaceView),
  { ssr: false }
);

/* ── Position type (used by page + card) ──────── */
export interface Position {
  id: string;
  tokenId: string;
  slug: string;
  market: string;
  asset: 'BTC' | 'ETH' | 'SOL';
  side: 'UP' | 'DOWN';
  entryPrice: number;
  amount: number;
  shares: number;
  marketEndTime: number;
  status: 'live' | 'resolving' | 'won' | 'lost';
  pnl?: number;
  orderId?: string;
  createdAt: number;
}

interface SynthMarketCardProps {
  market: SynthMarketData;
  liveBinancePrice: number;
  pricesRef: React.MutableRefObject<PricePoint[]>;
  latestPriceRef: React.MutableRefObject<{ price: number; time: number }>;
  smoothPriceRef: React.MutableRefObject<{ price: number; time: number }>;
  connected: boolean;
  position: Position | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTrade: (side: 'UP' | 'DOWN', market: SynthMarketData, amount: number) => void;
  onSell?: (position: Position) => void;
  isTrading: boolean;
  defaultAmount: number;
  isSelected?: boolean;
  bankroll?: number | null;
}

/* ── Constants ────────────────────────────────── */
const ASSET_ICONS: Record<string, string> = { BTC: '₿', ETH: 'Ξ', SOL: '◎' };
const ASSET_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  BTC: { bg: 'rgba(247,147,26,0.15)', text: '#F7931A', border: 'rgba(247,147,26,0.3)' },
  ETH: { bg: 'rgba(98,126,234,0.15)', text: '#627EEA', border: 'rgba(98,126,234,0.3)' },
  SOL: { bg: 'rgba(153,69,255,0.15)', text: '#9945FF', border: 'rgba(153,69,255,0.3)' },
};
const AMOUNTS = [1, 5, 10, 25];

/* ── Countdown hook ──────────────────────────── */
function useCountdown(endTimeIso: string | null) {
  const [text, setText] = useState('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!endTimeIso) { setText(''); return; }
    const endMs = new Date(endTimeIso).getTime();
    const tick = () => {
      const ms = endMs - Date.now();
      if (ms <= 0) { setText('Resolving...'); setExpired(true); return; }
      setExpired(false);
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1_000);
      setText(h > 0
        ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        : `${m}:${s.toString().padStart(2, '0')}`
      );
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [endTimeIso]);

  return { text, expired };
}

/* ── Format helpers ──────────────────────────── */
function formatPrice(p: number) {
  if (p >= 10000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (p >= 100) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
  return `$${p.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function toCents(p: number) {
  return `${(p * 100).toFixed(0)}¢`;
}

/* ── Component ────────────────────────────────── */
export function SynthMarketCard({
  market,
  liveBinancePrice,
  pricesRef,
  latestPriceRef,
  smoothPriceRef,
  connected,
  position,
  isExpanded,
  onToggleExpand,
  onTrade,
  onSell,
  isTrading,
  defaultAmount,
  isSelected,
  bankroll,
}: SynthMarketCardProps) {
  const { text: countdown, expired } = useCountdown(market.event_end_time);
  const posCountdown = useCountdown(
    position?.marketEndTime ? new Date(position.marketEndTime).toISOString() : null
  );
  const [localAmount, setLocalAmount] = useState(defaultAmount);
  const [selectedSide, setSelectedSide] = useState<'UP' | 'DOWN'>('UP');

  // Edge calculation
  const edge = (market.synth_probability_up - market.polymarket_probability_up) * 100;
  const absEdge = Math.abs(edge);
  const hasEdge = absEdge >= 5;
  const isStrongEdge = absEdge >= 10;

  const priceUp = liveBinancePrice >= market.start_price;
  const colors = ASSET_COLORS[market.asset] || ASSET_COLORS.BTC;

  // YES = UP, NO = DOWN
  const yesPrice = market.best_ask_price || market.polymarket_probability_up;
  const noPrice = 1 - yesPrice;

  // Kelly Criterion (half-Kelly)
  const kellyAmount = (() => {
    if (!hasEdge || !bankroll || bankroll <= 0) return null;
    const synthProb = selectedSide === 'UP' ? market.synth_probability_up : (1 - market.synth_probability_up);
    const price = selectedSide === 'UP' ? yesPrice : noPrice;
    if (price <= 0 || price >= 1 || synthProb <= 0 || synthProb >= 1) return null;
    const b = (1 / price) - 1; // payout odds
    const p = synthProb;
    const q = 1 - p;
    const halfKelly = (b * p - q) / (2 * b);
    if (halfKelly <= 0) return null;
    const amount = Math.round(halfKelly * bankroll * 100) / 100;
    return Math.max(1, Math.min(100, amount));
  })();

  const tfLabel = market.timeframe === 'hourly' ? '1H' : '15M';
  const fullName = `${market.asset === 'BTC' ? 'Bitcoin' : market.asset === 'ETH' ? 'Ethereum' : 'Solana'} Up or Down - ${market.timeframe === 'hourly' ? 'Hourly' : '15 min'}`;

  // Card border
  const borderClass = position
    ? position.status === 'won'
      ? 'border-profit/60'
      : position.status === 'lost'
        ? 'border-loss/60'
        : position.side === 'UP'
          ? 'border-profit/40'
          : 'border-loss/40'
    : isStrongEdge
      ? 'border-purple-400/40'
      : hasEdge
        ? 'border-purple-400/20'
        : 'border-ep-border';

  // ── Expanded order entry calculations ──
  const orderPrice = selectedSide === 'UP' ? yesPrice : noPrice;
  const shares = localAmount / orderPrice;
  const toWin = shares * 1 - localAmount;

  // ── Quick trade handler (compact card buttons) ──
  const handleQuickTrade = (side: 'UP' | 'DOWN', e: React.MouseEvent) => {
    e.stopPropagation();
    onTrade(side, market, defaultAmount);
  };

  // ── Expanded trade handler ──
  const handleExpandedTrade = () => {
    onTrade(selectedSide, market, localAmount);
  };

  /* ═══════════════ COMPACT CARD ═══════════════ */
  if (!isExpanded) {
    return (
      <div
        className={`ep-card overflow-hidden border-2 transition-all duration-300 ${
          isSelected ? 'border-accent/50 ring-2 ring-accent/20 shadow-lg shadow-accent/5' : borderClass
        } ${isStrongEdge && !isSelected ? 'shadow-lg shadow-purple-500/10' : ''}`}
      >
        {/* Header — clickable to expand */}
        <button
          type="button"
          onClick={onToggleExpand}
          className="w-full text-left cursor-pointer px-4 pt-3 pb-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{ background: colors.bg, color: colors.text, border: `2px solid ${colors.border}` }}
              >
                {ASSET_ICONS[market.asset] || '?'}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-text-primary">{fullName}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!expired && countdown && (
                <span className="text-xs font-mono text-text-muted">{countdown}</span>
              )}
              {expired ? (
                <span className="text-[10px] px-2 py-0.5 rounded bg-conviction-medium/15 text-conviction-medium font-semibold animate-pulse">
                  Resolving
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-profit font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-profit animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
          </div>
        </button>

        {/* Price — clickable to expand */}
        <button
          type="button"
          onClick={onToggleExpand}
          className="w-full text-left cursor-pointer px-4 pb-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-lg font-mono font-bold text-text-primary">
              {liveBinancePrice > 0 ? formatPrice(liveBinancePrice) : '...'}
            </span>
            <div className="flex items-center gap-2">
              {hasEdge && (
                <span className={`text-[10px] font-bold ${isStrongEdge ? 'text-purple-300' : 'text-purple-400/70'}`}>
                  {isStrongEdge ? '🔥' : '⚡'}{edge > 0 ? '+' : ''}{edge.toFixed(1)}% edge
                  {isStrongEdge && (
                    <span className="ml-1 px-1 py-0.5 bg-purple-500/20 text-purple-300 rounded text-[9px]">STRONG</span>
                  )}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-text-muted mt-0.5">
            <span>
              Synth AI: <span className="font-mono text-purple-300 font-semibold">{(market.synth_probability_up * 100).toFixed(0)}% {market.synth_outcome}</span>
            </span>
            <span>
              Poly: <span className="font-mono text-text-secondary">{(market.polymarket_probability_up * 100).toFixed(0)}% {market.polymarket_outcome}</span>
            </span>
          </div>
        </button>

        {/* Position overlay */}
        {position && (
          <div className="px-4 pb-2">
            <div className={`rounded-lg px-3 py-2 border text-xs flex items-center justify-between ${
              position.status === 'won' ? 'bg-profit/10 border-profit/30' :
              position.status === 'lost' ? 'bg-loss/10 border-loss/30' :
              position.side === 'UP' ? 'bg-profit/5 border-profit/20' : 'bg-loss/5 border-loss/20'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                  position.side === 'UP' ? 'bg-profit/15 text-profit' : 'bg-loss/15 text-loss'
                }`}>
                  {position.side === 'UP' ? '▲ UP' : '▼ DN'}
                </span>
                <span className="text-text-secondary">${position.amount} @ {toCents(position.entryPrice)}</span>
              </div>
              {position.status === 'resolving' && (
                <span className="text-conviction-medium animate-pulse font-semibold text-[10px]">Resolving...</span>
              )}
              {(position.status === 'won' || position.status === 'lost') && position.pnl !== undefined && (
                <span className={`font-mono font-bold ${position.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
                </span>
              )}
              {position.status === 'live' && (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-text-muted text-[10px]">{posCountdown.text}</span>
                  {onSell && (
                    <button
                      onClick={() => onSell(position)}
                      className="px-2 py-0.5 rounded bg-loss/10 text-loss border border-loss/20 hover:bg-loss/20 transition font-semibold text-[10px]"
                    >
                      SELL
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Up/Down buttons */}
        <div className="px-4 pb-2 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={(e) => handleQuickTrade('UP', e)}
              disabled={isTrading || expired || !!position}
              className="py-2.5 rounded-lg font-bold text-sm transition-all
                         bg-profit/10 text-profit border border-profit/20
                         hover:bg-profit/20 hover:border-profit/40
                         disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isTrading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                </span>
              ) : (
                <>Up {toCents(yesPrice)}</>
              )}
            </button>
            <button
              onClick={(e) => handleQuickTrade('DOWN', e)}
              disabled={isTrading || expired || !!position}
              className="py-2.5 rounded-lg font-bold text-sm transition-all
                         bg-loss/10 text-loss border border-loss/20
                         hover:bg-loss/20 hover:border-loss/40
                         disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isTrading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                </span>
              ) : (
                <>Down {toCents(noPrice)}</>
              )}
            </button>
          </div>
        </div>

        {/* Expand hint — clickable button */}
        <button
          type="button"
          onClick={onToggleExpand}
          className={`w-full px-4 pb-2.5 flex items-center justify-center gap-1 text-[10px] transition cursor-pointer hover:bg-white/[0.02] ${
            isSelected ? 'text-accent' : 'text-text-muted/60 hover:text-text-muted'
          }`}
        >
          <svg className={`w-3 h-3 transition-transform duration-200 ${isSelected ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <span>{isSelected ? 'Tap to collapse' : 'Tap to expand'}</span>
        </button>

        {/* ── Inline expanded content (renders inside the card) ── */}
        {isSelected && (
          <div className="border-t border-ep-border/50">
            {/* Price context bar */}
            <div className="px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted bg-ep-surface/50">
              <span>Beat price: <span className="font-mono text-text-secondary">{formatPrice(market.start_price)}</span></span>
              <span>Current: <span className={`font-mono font-semibold ${priceUp ? 'text-profit' : 'text-loss'}`}>{formatPrice(liveBinancePrice)} {priceUp ? '▲' : '▼'}</span></span>
            </div>

            <div className="flex flex-col lg:flex-row">
              {/* Chart section */}
              <div className="flex-1 p-3 min-h-[180px]">
                <MiniRaceView
                  pricesRef={pricesRef}
                  latestPriceRef={latestPriceRef}
                  smoothPriceRef={smoothPriceRef}
                  currentPrice={liveBinancePrice}
                  connected={connected}
                  activeBet={position ? {
                    side: position.side,
                    entryPrice: position.entryPrice,
                    amount: position.amount,
                    shares: position.shares,
                    market: position.market,
                    marketEndTime: position.marketEndTime,
                  } : null}
                />
              </div>

              {/* Order entry panel */}
              <div className="w-full lg:w-[260px] border-t lg:border-t-0 lg:border-l border-ep-border/50 p-4 space-y-3">
                {/* Direction toggle */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedSide('UP')}
                    className={`py-2 rounded-lg font-bold text-xs transition-all ${
                      selectedSide === 'UP'
                        ? 'bg-profit/20 text-profit border-2 border-profit/50'
                        : 'bg-ep-border/30 text-text-muted border-2 border-transparent hover:border-ep-border'
                    }`}
                  >
                    ▲ Up {toCents(yesPrice)}
                  </button>
                  <button
                    onClick={() => setSelectedSide('DOWN')}
                    className={`py-2 rounded-lg font-bold text-xs transition-all ${
                      selectedSide === 'DOWN'
                        ? 'bg-loss/20 text-loss border-2 border-loss/50'
                        : 'bg-ep-border/30 text-text-muted border-2 border-transparent hover:border-ep-border'
                    }`}
                  >
                    ▼ Dn {toCents(noPrice)}
                  </button>
                </div>

                {/* Amount selector */}
                <div>
                  <label className="text-[10px] text-text-muted mb-1 block">Amount</label>
                  <div className="flex gap-1">
                    {AMOUNTS.map((a) => (
                      <button
                        key={a}
                        onClick={() => setLocalAmount(a)}
                        className={`flex-1 py-1 rounded text-xs font-bold transition ${
                          localAmount === a
                            ? 'bg-accent/20 text-accent border border-accent/40'
                            : 'bg-ep-border/30 text-text-muted border border-transparent hover:border-ep-border'
                        }`}
                      >
                        ${a}
                      </button>
                    ))}
                  </div>
                  {kellyAmount !== null && (
                    <button
                      onClick={() => setLocalAmount(kellyAmount)}
                      className={`w-full mt-1.5 flex items-center justify-between px-2 py-1.5 rounded border text-[10px] transition cursor-pointer ${
                        localAmount === kellyAmount
                          ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                          : 'bg-purple-500/5 border-purple-500/15 text-purple-400/80 hover:bg-purple-500/10 hover:border-purple-500/25'
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <span>⚡</span>
                        <span className="font-bold">Kelly suggests ${kellyAmount.toFixed(2)}</span>
                      </span>
                      <span className="text-text-muted">
                        Half-Kelly · {(((selectedSide === 'UP' ? market.synth_probability_up : 1 - market.synth_probability_up) * 100)).toFixed(0)}% Synth
                      </span>
                    </button>
                  )}
                </div>

                {/* Order summary */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-text-muted">
                    <span>Shares</span>
                    <span className="font-mono text-text-secondary">{shares.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-text-muted">
                    <span>Avg price</span>
                    <span className="font-mono text-text-secondary">{toCents(orderPrice)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-text-secondary">Potential win</span>
                    <span className="font-mono text-profit">+${toWin.toFixed(2)}</span>
                  </div>
                </div>

                {/* Synth AI signal */}
                {hasEdge && (
                  <div className="p-2 rounded bg-purple-500/5 border border-purple-500/15 text-[10px]">
                    <span className="font-bold text-purple-300">Synth AI: </span>
                    <span className="text-text-muted">
                      {(market.synth_probability_up * 100).toFixed(0)}% {market.synth_outcome}
                    </span>
                    <span className={`ml-1 font-bold ${isStrongEdge ? 'text-purple-300' : 'text-purple-400/70'}`}>
                      {isStrongEdge ? '🔥' : '⚡'}{edge > 0 ? '+' : ''}{edge.toFixed(1)}%
                    </span>
                  </div>
                )}

                {/* Active position indicator */}
                {position && position.status === 'live' && (
                  <div className={`p-2 rounded border text-[10px] flex items-center justify-between ${
                    position.side === 'UP' ? 'bg-profit/5 border-profit/20' : 'bg-loss/5 border-loss/20'
                  }`}>
                    <span className="text-text-secondary">
                      {position.side} ${position.amount} @ {toCents(position.entryPrice)}
                    </span>
                    {onSell && (
                      <button
                        onClick={() => onSell(position)}
                        className="px-2 py-0.5 rounded bg-loss/10 text-loss border border-loss/20 hover:bg-loss/20 transition font-semibold"
                      >
                        SELL
                      </button>
                    )}
                  </div>
                )}

                {/* Execute button */}
                <button
                  onClick={handleExpandedTrade}
                  disabled={isTrading || expired || !!position}
                  className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    selectedSide === 'UP'
                      ? 'bg-profit text-white hover:brightness-110'
                      : 'bg-loss text-white hover:brightness-110'
                  }`}
                >
                  {isTrading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Placing...
                    </span>
                  ) : (
                    <>Buy {selectedSide === 'UP' ? 'Up' : 'Down'} ${localAmount}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ═══════════════ EXPANDED CARD ═══════════════ */
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`ep-card overflow-hidden border-2 transition-colors duration-300 ${borderClass} ${
        isStrongEdge ? 'shadow-lg shadow-purple-500/10' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-ep-border/50">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-base font-bold shrink-0"
            style={{ background: colors.bg, color: colors.text, border: `2px solid ${colors.border}` }}
          >
            {ASSET_ICONS[market.asset] || '?'}
          </div>
          <div>
            <h3 className="font-bold text-text-primary">{fullName}</h3>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span>Price to beat: <span className="font-mono text-text-secondary">{formatPrice(market.start_price)}</span></span>
              <span>•</span>
              <span>Current: <span className={`font-mono font-semibold ${priceUp ? 'text-profit' : 'text-loss'}`}>{formatPrice(liveBinancePrice)}</span></span>
              <span className={`font-bold ${priceUp ? 'text-profit' : 'text-loss'}`}>{priceUp ? '▲' : '▼'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!expired && countdown && (
            <div className="flex items-center gap-1.5 text-text-muted">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-mono text-sm font-semibold">{countdown}</span>
            </div>
          )}
          {expired && (
            <span className="text-xs px-2.5 py-1 rounded bg-conviction-medium/15 text-conviction-medium font-semibold animate-pulse">
              Resolving...
            </span>
          )}
          <span className="flex items-center gap-1 text-[10px] text-profit font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-profit animate-pulse" />
            LIVE
          </span>
          <button
            onClick={onToggleExpand}
            className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body: chart + order panel */}
      <div className="flex flex-col lg:flex-row">
        {/* Chart section */}
        <div className="flex-1 p-4 min-h-[240px]">
          <MiniRaceView
            pricesRef={pricesRef}
            latestPriceRef={latestPriceRef}
            smoothPriceRef={smoothPriceRef}
            currentPrice={liveBinancePrice}
            connected={connected}
            activeBet={position ? {
              side: position.side,
              entryPrice: position.entryPrice,
              amount: position.amount,
              shares: position.shares,
              market: position.market,
              marketEndTime: position.marketEndTime,
            } : null}
          />
        </div>

        {/* Order entry panel */}
        <div className="w-full lg:w-[320px] border-t lg:border-t-0 lg:border-l border-ep-border/50 p-5">
          {/* Direction toggle */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => setSelectedSide('UP')}
              className={`py-2.5 rounded-lg font-bold text-sm transition-all ${
                selectedSide === 'UP'
                  ? 'bg-profit/20 text-profit border-2 border-profit/50'
                  : 'bg-ep-border/30 text-text-muted border-2 border-transparent hover:border-ep-border'
              }`}
            >
              ▲ Up {toCents(yesPrice)}
            </button>
            <button
              onClick={() => setSelectedSide('DOWN')}
              className={`py-2.5 rounded-lg font-bold text-sm transition-all ${
                selectedSide === 'DOWN'
                  ? 'bg-loss/20 text-loss border-2 border-loss/50'
                  : 'bg-ep-border/30 text-text-muted border-2 border-transparent hover:border-ep-border'
              }`}
            >
              ▼ Down {toCents(noPrice)}
            </button>
          </div>

          {/* Amount */}
          <div className="mb-3">
            <label className="text-xs text-text-muted mb-1.5 block">Amount</label>
            <div className="flex gap-1.5">
              {AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() => setLocalAmount(a)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                    localAmount === a
                      ? 'bg-accent/20 text-accent border border-accent/40'
                      : 'bg-ep-border/30 text-text-muted border border-transparent hover:border-ep-border'
                  }`}
                >
                  ${a}
                </button>
              ))}
            </div>
            {kellyAmount !== null && (
              <button
                onClick={() => setLocalAmount(kellyAmount)}
                className={`w-full mt-2 flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition cursor-pointer ${
                  localAmount === kellyAmount
                    ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                    : 'bg-purple-500/5 border-purple-500/15 text-purple-400/80 hover:bg-purple-500/10 hover:border-purple-500/25'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span>⚡</span>
                  <span className="font-bold">Kelly suggests ${kellyAmount.toFixed(2)}</span>
                </span>
                <span className="text-text-muted text-[10px]">
                  Half-Kelly · {(((selectedSide === 'UP' ? market.synth_probability_up : 1 - market.synth_probability_up) * 100)).toFixed(0)}% Synth
                </span>
              </button>
            )}
          </div>

          {/* Order summary */}
          <div className="space-y-2 mb-4 text-xs">
            <div className="flex justify-between text-text-muted">
              <span>Shares</span>
              <span className="font-mono text-text-secondary">{shares.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-text-muted">
              <span>Avg price</span>
              <span className="font-mono text-text-secondary">{toCents(orderPrice)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-text-secondary">To win</span>
              <span className="font-mono text-profit">${toWin.toFixed(2)}</span>
            </div>
          </div>

          {/* Synth AI signal */}
          <div className="mb-4 p-3 rounded-lg bg-purple-500/5 border border-purple-500/15">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">Synth AI</span>
              {hasEdge && (
                <span className={`text-[10px] font-bold ${isStrongEdge ? 'text-purple-300' : 'text-purple-400/70'}`}>
                  {isStrongEdge ? '🔥' : '⚡'}{edge > 0 ? '+' : ''}{edge.toFixed(1)}% edge
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-text-muted">
                Synth: <span className="font-mono text-purple-300 font-semibold">{(market.synth_probability_up * 100).toFixed(0)}% {market.synth_outcome}</span>
              </span>
              <span className="text-text-muted">
                Poly: <span className="font-mono text-text-secondary">{(market.polymarket_probability_up * 100).toFixed(0)}% {market.polymarket_outcome}</span>
              </span>
            </div>
          </div>

          {/* Active position */}
          {position && (
            <div className={`mb-4 p-3 rounded-lg border ${
              position.status === 'won' ? 'bg-profit/10 border-profit/30' :
              position.status === 'lost' ? 'bg-loss/10 border-loss/30' :
              position.side === 'UP' ? 'bg-profit/5 border-profit/20' : 'bg-loss/5 border-loss/20'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                    position.side === 'UP' ? 'bg-profit/15 text-profit' : 'bg-loss/15 text-loss'
                  }`}>{position.side === 'UP' ? '▲ UP' : '▼ DN'}</span>
                  <span className="text-xs text-text-secondary">${position.amount} @ {toCents(position.entryPrice)}</span>
                </div>
                {position.status === 'live' && onSell && (
                  <button
                    onClick={() => onSell(position)}
                    className="text-[10px] px-2 py-0.5 rounded bg-loss/10 text-loss border border-loss/20 hover:bg-loss/20 transition font-semibold"
                  >
                    SELL
                  </button>
                )}
                {(position.status === 'won' || position.status === 'lost') && position.pnl !== undefined && (
                  <span className={`font-mono text-xs font-bold ${position.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Execute button */}
          <button
            onClick={handleExpandedTrade}
            disabled={isTrading || expired || !!position}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              selectedSide === 'UP'
                ? 'bg-profit text-white hover:brightness-110'
                : 'bg-loss text-white hover:brightness-110'
            }`}
          >
            {isTrading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Placing...
              </span>
            ) : (
              <>Buy {selectedSide === 'UP' ? 'Up' : 'Down'} ${localAmount}</>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
