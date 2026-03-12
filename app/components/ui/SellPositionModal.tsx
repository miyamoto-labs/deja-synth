'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useClobClient } from '@/app/lib/hooks/useClobClient';
import { useUserStore } from '@/app/lib/stores/user-store';
import { useToast } from './Toast';

export interface SellPosition {
  id: string;
  question: string;
  outcome: string;
  size: number;
  avgPrice: number;
  curPrice: number;
  livePrice?: number | null;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  assetId: string;
  sellDisabled?: boolean;
  sellDisabledReason?: string;
}

interface SellPositionModalProps {
  position: SellPosition | null;
  onClose: () => void;
  onSuccess: () => void;
}

type SellMode = 'market' | 'limit';

const PRESETS = [25, 50, 75, 100] as const;

export function SellPositionModal({ position, onClose, onSuccess }: SellPositionModalProps) {
  const [selling, setSelling] = useState(false);
  const [pct, setPct] = useState<number>(100);
  const [customShares, setCustomShares] = useState<string>('');
  const [sellMode, setSellMode] = useState<SellMode>('market');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const { sellPosition, marketSellPosition, isReady } = useClobClient();
  const { walletAddress } = useUserStore();
  const { toast } = useToast();

  // ── Fetch real-time CLOB best bid when modal opens ───────
  const [clobBestBid, setClobBestBid] = useState<number | null>(null);
  const [fetchingPrice, setFetchingPrice] = useState(false);

  useEffect(() => {
    if (!position?.assetId) {
      setClobBestBid(null);
      return;
    }

    let cancelled = false;
    setFetchingPrice(true);
    setClobBestBid(null);

    fetch(`/api/polymarket/orderbook?tokenId=${encodeURIComponent(position.assetId)}`)
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then(data => {
        if (cancelled) return;
        if (data.bids?.length > 0) {
          setClobBestBid(data.bids[0].price);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFetchingPrice(false);
      });

    return () => { cancelled = true; };
  }, [position?.assetId]);

  // Derive sell size from either preset pct or custom shares input
  const sellSize = useMemo(() => {
    if (!position) return 0;
    if (customShares !== '') {
      const v = parseFloat(customShares);
      if (!isNaN(v) && v > 0) return Math.min(v, position.size);
      return 0;
    }
    return Math.round(position.size * pct) / 100;
  }, [position, pct, customShares]);

  const isFullSell = position ? Math.abs(sellSize - position.size) < 0.001 : false;

  const selectPreset = useCallback((p: number) => {
    setPct(p);
    setCustomShares(''); // clear custom input when using presets
  }, []);

  const handleCustomChange = useCallback((val: string) => {
    setCustomShares(val);
    setPct(0); // deselect presets when typing custom
  }, []);

  if (!position) return null;

  // Prefer real-time CLOB best bid over stale Gamma mid-market price.
  const hasClobPrice = clobBestBid != null && clobBestBid > 0;
  const gammaPrice = position.livePrice || position.curPrice;
  const rawPrice = hasClobPrice ? clobBestBid : gammaPrice;
  const hasLivePrice = hasClobPrice || (position.livePrice != null && position.livePrice > 0);

  // For market sell: use CLOB best bid directly (FOK will fill at best available).
  // For limit sell: use user-specified price, or CLOB bid / Gamma with 2% discount as default.
  const userLimitPrice = limitPrice !== '' ? parseFloat(limitPrice) / 100 : null; // cents → decimal
  const limitEffectivePrice = userLimitPrice && userLimitPrice > 0
    ? userLimitPrice
    : hasClobPrice
      ? Math.max(rawPrice, 0.01)
      : Math.max(Math.round(rawPrice * 98) / 100, 0.01);

  // Display price depends on mode
  const displayPrice = sellMode === 'market' ? rawPrice : limitEffectivePrice;
  const estimatedProceeds = sellSize * displayPrice;
  const costBasis = sellSize * position.avgPrice;
  const sellPnl = estimatedProceeds - costBasis;
  const sellPnlPct = costBasis > 0 ? (sellPnl / costBasis) * 100 : 0;
  const isProfit = sellPnl >= 0;

  // Initialize limit price field from current best bid
  const defaultLimitCents = Math.max(Math.round(rawPrice * 100), 1).toString();

  const handleSell = async () => {
    if (!isReady) {
      toast('error', 'Not Ready', 'Trading session not initialized. Try logging in again.');
      return;
    }

    if (!position.assetId) {
      toast('error', 'Missing Data', 'Cannot sell — token ID not available for this position.');
      return;
    }

    if (sellSize <= 0) {
      toast('error', 'Invalid Amount', 'Enter a valid number of shares to sell.');
      return;
    }

    setSelling(true);
    try {
      let result: any;

      if (sellMode === 'market') {
        // Market sell: GTC limit order with 15% slippage for reliable fill
        if (!marketSellPosition) {
          toast('error', 'Not Ready', 'Market sell not available. Try logging in again.');
          setSelling(false);
          return;
        }
        const sellPrice = clobBestBid || position.curPrice || 0.5;
        result = await marketSellPosition({
          tokenID: position.assetId,
          amount: sellSize,
          price: sellPrice,
        });
      } else {
        // Limit sell: GTC order at user-specified price
        if (!sellPosition) {
          toast('error', 'Not Ready', 'Limit sell not available. Try logging in again.');
          setSelling(false);
          return;
        }
        if (limitEffectivePrice <= 0) {
          toast('error', 'No Price', 'Enter a valid limit price.');
          setSelling(false);
          return;
        }
        result = await sellPosition({
          tokenID: position.assetId,
          size: sellSize,
          price: limitEffectivePrice,
        });
      }

      // Log the sell trade to ep_user_trades so it appears in Activity
      if (walletAddress) {
        fetch('/api/trade/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress,
            tokenId: position.assetId,
            side: 'SELL',
            direction: position.outcome.toUpperCase(),
            amount: estimatedProceeds,
            price: displayPrice,
            source: 'manual',
          }),
        }).catch(() => { /* non-critical */ });
      }

      const modeLabel = sellMode === 'market' ? 'Market' : 'Limit';
      const label = isFullSell ? `${modeLabel} Close Placed` : `${modeLabel} Sell Placed`;
      toast('success',
        label,
        sellMode === 'market'
          ? `Market sold ${sellSize.toFixed(1)} of ${position.size.toFixed(1)} ${position.outcome} shares`
          : `Limit sell ${sellSize.toFixed(1)} shares at ${(limitEffectivePrice * 100).toFixed(1)}¢`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Sell failed:', err);
      const errMsg = err?.message || 'Could not close position.';
      const isFokFail = errMsg.includes('not enough liquidity') || errMsg.includes('FOK');
      toast('error',
        'Sell Failed',
        isFokFail
          ? 'Not enough liquidity to fill the entire order. Try a smaller amount or use Limit sell.'
          : errMsg
      );
    } finally {
      setSelling(false);
    }
  };

  const remainingShares = position.size - sellSize;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="ep-card rounded-2xl p-6 max-w-sm w-full border border-ep-border shadow-card"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <h3 className="font-display text-lg font-bold text-text-primary">
              {isFullSell ? 'Close Position' : 'Sell Shares'}
            </h3>
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Market question */}
          <p className="text-sm text-text-secondary leading-snug mb-4">
            {position.question}
          </p>

          {/* ─── Market / Limit toggle ──────────────────── */}
          <div className="flex rounded-lg bg-ep-surface border border-ep-border p-0.5 mb-4">
            <button
              onClick={() => setSellMode('market')}
              className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${
                sellMode === 'market'
                  ? 'bg-loss/20 text-loss border border-loss/30'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Market
            </button>
            <button
              onClick={() => {
                setSellMode('limit');
                if (limitPrice === '') setLimitPrice(defaultLimitCents);
              }}
              className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${
                sellMode === 'limit'
                  ? 'bg-accent/20 text-accent border border-accent/30'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Limit
            </button>
          </div>

          {/* Mode description */}
          <div className="mb-4 px-2">
            {sellMode === 'market' ? (
              <p className="text-[10px] text-text-muted leading-relaxed">
                Sells immediately at the best available bid. Fills entirely or cancels (FOK).
              </p>
            ) : (
              <p className="text-[10px] text-text-muted leading-relaxed">
                Places a limit order that stays open until filled at your price or better.
              </p>
            )}
          </div>

          {/* Position details */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">Outcome</span>
              <span className={`font-bold px-2 py-0.5 rounded ${
                position.outcome.toUpperCase() === 'YES'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {position.outcome.toUpperCase()}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">Total Shares</span>
              <span className="font-mono text-text-primary">{position.size.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">Entry Price</span>
              <span className="font-mono text-text-secondary">{(position.avgPrice * 100).toFixed(1)}¢</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">
                {hasClobPrice ? 'Best Bid' : 'Est. Price'}
              </span>
              <span className="font-mono text-text-primary flex items-center gap-1.5">
                {fetchingPrice ? (
                  <span className="text-text-muted">loading...</span>
                ) : (
                  <>{(rawPrice * 100).toFixed(1)}¢</>
                )}
                {hasClobPrice ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-profit animate-pulse" title="Live CLOB best bid" />
                ) : hasLivePrice ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" title="Gamma estimate (may be stale)" />
                ) : null}
              </span>
            </div>
          </div>

          {/* ─── Limit price input (only in limit mode) ── */}
          {sellMode === 'limit' && (
            <div className="mb-4">
              <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-2 font-medium">
                Limit Price (¢)
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="1"
                  max="99"
                  placeholder="e.g. 55"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-ep-surface border border-ep-border text-xs font-mono text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50 transition"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-text-muted">¢</span>
              </div>
              {userLimitPrice && userLimitPrice > rawPrice && (
                <p className="text-[10px] text-yellow-400 mt-1">
                  Price above current market — order may not fill immediately
                </p>
              )}
            </div>
          )}

          {/* ─── Amount selector ──────────────────────── */}
          <div className="mb-4">
            <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-2 font-medium">
              Amount to sell
            </label>

            {/* Preset % buttons */}
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              {PRESETS.map((p) => {
                const active = pct === p && customShares === '';
                return (
                  <button
                    key={p}
                    onClick={() => selectPreset(p)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      active
                        ? 'bg-accent/20 text-accent border border-accent/40'
                        : 'bg-ep-surface text-text-secondary border border-ep-border hover:border-text-muted'
                    }`}
                  >
                    {p === 100 ? 'All' : `${p}%`}
                  </button>
                );
              })}
            </div>

            {/* Custom shares input */}
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                max={position.size}
                placeholder={`Custom shares (max ${position.size.toFixed(2)})`}
                value={customShares}
                onChange={(e) => handleCustomChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-ep-surface border border-ep-border text-xs font-mono text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50 transition"
              />
              {customShares !== '' && (
                <button
                  onClick={() => { setCustomShares(''); setPct(100); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary text-[10px]"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* ─── Sell summary ─────────────────────────── */}
          <div className="space-y-2 mb-5 p-3 rounded-xl bg-ep-surface/50 border border-ep-border/50">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">Selling</span>
              <span className="font-mono font-bold text-text-primary">
                {sellSize.toFixed(2)} shares
                {!isFullSell && (
                  <span className="text-text-muted font-normal ml-1">
                    ({((sellSize / position.size) * 100).toFixed(0)}%)
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">
                {sellMode === 'market' ? 'Est. Proceeds' : 'Proceeds at Limit'}
              </span>
              <span className="font-mono font-bold text-text-primary">
                ${estimatedProceeds.toFixed(2)}
                {sellMode === 'market' && (
                  <span className="text-text-muted font-normal ml-1 text-[10px]">~approx</span>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">P&L</span>
              <span className={`font-mono font-bold ${isProfit ? 'text-profit' : 'text-loss'}`}>
                {isProfit ? '+' : ''}${sellPnl.toFixed(2)} ({isProfit ? '+' : ''}{sellPnlPct.toFixed(1)}%)
              </span>
            </div>

            {!isFullSell && remainingShares > 0.001 && (
              <div className="flex items-center justify-between text-xs border-t border-ep-border/50 pt-2 mt-1">
                <span className="text-text-muted">Remaining</span>
                <span className="font-mono text-text-secondary">
                  {remainingShares.toFixed(2)} shares
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-text-secondary bg-ep-surface border border-ep-border hover:border-ep-border/80 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSell}
              disabled={
                selling || !isReady || !position.assetId || sellSize <= 0 || fetchingPrice ||
                (sellMode === 'limit' && limitEffectivePrice <= 0)
              }
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-loss hover:bg-loss/90 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {selling ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Selling...
                </>
              ) : sellMode === 'market' ? (
                isFullSell ? 'Market Sell All' : `Market Sell ${((sellSize / position.size) * 100).toFixed(0)}%`
              ) : (
                isFullSell ? 'Limit Sell All' : `Limit Sell ${((sellSize / position.size) * 100).toFixed(0)}%`
              )}
            </button>
          </div>

          {!isReady && (
            <p className="text-[10px] text-yellow-400 text-center mt-3">
              Trading session not ready — log in to enable selling
            </p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
