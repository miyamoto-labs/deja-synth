'use client';

import { useState, useEffect } from 'react';

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

interface ArcadePositionsProps {
  activeBets: ActiveBet[];
  currentPrices: Record<string, number>; // e.g. { 'BTC-5m': 0.52, 'ETH-5m': 0.48 }
  onSellBet: (bet: ActiveBet) => void;
  sellingId: string | null;
}

/* ── Countdown ── */
function Countdown({ endTime }: { endTime: number }) {
  const [text, setText] = useState('');

  useEffect(() => {
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

  return <span className="text-conviction-medium font-mono">{text}</span>;
}

/* ── Component ─────────────────────────────────── */
export function ArcadePositions({ activeBets, currentPrices, onSellBet, sellingId }: ArcadePositionsProps) {
  if (activeBets.length === 0) {
    return null;
  }

  const liveBets = activeBets.filter((b) => b.status === 'live' || b.status === 'resolving');

  if (liveBets.length === 0) return null;

  return (
    <div className="ep-card overflow-hidden">
      <div className="px-3 py-2 border-b border-ep-border">
        <h3 className="text-[10px] font-semibold text-text-primary uppercase tracking-wider">
          Active Positions
        </h3>
      </div>

      <div className="divide-y divide-ep-border/30">
        {liveBets.map((bet) => {
          const assetKey = bet.market;
          // For the current market price, try to match to yesPrice for UP bets, noPrice for DOWN
          // Since we track by market string, use the currentPrices map
          const currentPrice = currentPrices[assetKey] ?? bet.entryPrice;

          // Unrealized P&L: for UP bets, value = shares * currentUpPrice
          // For DOWN bets, value = shares * currentDownPrice
          const currentValue = bet.shares * currentPrice;
          const costBasis = bet.amount;
          const unrealizedPnl = currentValue - costBasis;
          const pnlPct = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;
          const isWinning = unrealizedPnl >= 0;

          return (
            <div key={bet.id} className="px-3 py-2 flex items-center justify-between gap-2">
              {/* Left: Side + Market */}
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                    bet.side === 'UP' ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'
                  }`}
                >
                  {bet.side}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] text-text-primary truncate">{bet.market}</p>
                  <p className="text-[9px] text-text-muted font-mono">
                    {bet.shares.toFixed(1)} shares @ {(bet.entryPrice * 100).toFixed(0)}c
                  </p>
                </div>
              </div>

              {/* Center: P&L */}
              <div className="text-right flex-shrink-0">
                <p className={`text-[10px] font-mono font-bold ${isWinning ? 'text-profit' : 'text-loss'}`}>
                  {unrealizedPnl >= 0 ? '+' : ''}{unrealizedPnl.toFixed(2)}
                  <span className="text-text-muted font-normal ml-1">
                    ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(0)}%)
                  </span>
                </p>
                <div className="text-[9px]">
                  <Countdown endTime={bet.marketEndTime} />
                </div>
              </div>

              {/* Right: SELL button */}
              <div className="flex-shrink-0">
                {bet.status === 'live' ? (
                  <button
                    onClick={() => onSellBet(bet)}
                    disabled={sellingId === bet.id}
                    className={`text-[9px] px-3 py-1 rounded-lg font-semibold transition ${
                      sellingId === bet.id
                        ? 'bg-ep-surface text-text-muted cursor-not-allowed'
                        : 'bg-conviction-medium/10 text-conviction-medium border border-conviction-medium/20 hover:bg-conviction-medium/20'
                    }`}
                  >
                    {sellingId === bet.id ? (
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 border border-conviction-medium/30 border-t-conviction-medium rounded-full animate-spin" />
                        Selling
                      </span>
                    ) : (
                      'SELL'
                    )}
                  </button>
                ) : (
                  <span className="text-[9px] text-conviction-medium animate-pulse">
                    Resolving...
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
