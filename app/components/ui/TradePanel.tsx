'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActionButton } from './ActionButton';
import { ConvictionGauge } from './ConvictionGauge';
import { DirectionBadge, TierBadge, StyleBadge } from './Badges';
import { WalletConnectButton } from './WalletConnectButton';
import { AskAI } from './AskAI';
import { useToast } from './Toast';
import { useUserStore } from '@/app/lib/stores/user-store';
import { useClobClient } from '@/app/lib/hooks/useClobClient';
import { useUsdcBalance } from '@/app/lib/hooks/useUsdcBalance';

/* ── Types ─────────────────────────────────────── */
export interface TradeTarget {
  type: 'pick' | 'signal' | 'market' | 'manual';
  /** For picks */
  pick?: {
    id: string;
    market_id: string;
    slug?: string;
    direction: string;
    conviction_score: number;
    entry_price: number;
    target_price: number;
    stop_loss: number;
    risk_reward: number;
    edge_explanation: string;
    market?: {
      question: string;
      yes_price: number;
      no_price: number;
      yes_token: string;
      no_token: string;
    };
  };
  /** For signals (copy trade) */
  signal?: {
    id: string;
    trader_id: string;
    market_id: string;
    direction: string;
    amount: number;
    price: number;
    trader?: {
      alias: string;
      roi: number;
      win_rate: number;
      bankroll_tier: string;
      trading_style: string;
    };
    market?: {
      question: string;
      yes_token?: string;
      no_token?: string;
      yes_price?: number;
      no_price?: number;
    };
  };
  /** For market pulse / direct market trades */
  market?: {
    market_id: string;
    question: string;
    yes_price: number;
    no_price: number;
    yes_token: string;
    no_token: string;
    /** Multi-choice outcomes (when clicking from a multi-choice event card) */
    outcomes?: {
      label: string;
      yes_price: number;
      market_id: string;
      yes_token: string;
      no_token: string;
    }[];
  };
  /** Pre-selected side */
  side: 'YES' | 'NO';
  /** Pre-fill amount (from quick-buy chips) */
  initialAmount?: number;
}

interface TradeContextType {
  isOpen: boolean;
  target: TradeTarget | null;
  openTrade: (target: TradeTarget) => void;
  closeTrade: () => void;
}

/* ── Context ───────────────────────────────────── */
const TradeContext = createContext<TradeContextType>({
  isOpen: false,
  target: null,
  openTrade: () => {},
  closeTrade: () => {},
});

export function useTradePanel() {
  return useContext(TradeContext);
}

/* ── Provider ──────────────────────────────────── */
export function TradeProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [target, setTarget] = useState<TradeTarget | null>(null);

  const openTrade = useCallback((t: TradeTarget) => {
    setTarget(t);
    setIsOpen(true);
  }, []);

  const closeTrade = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => setTarget(null), 300); // clear after animation
  }, []);

  return (
    <TradeContext.Provider value={{ isOpen, target, openTrade, closeTrade }}>
      {children}
      <TradePanel />
    </TradeContext.Provider>
  );
}

/* ── Trade Panel Component ─────────────────────── */
function TradePanel() {
  const { isOpen, target, openTrade, closeTrade } = useTradePanel();
  const { walletAddress, isConnected, hasCredentials, quickTradeEnabled, setQuickTradeEnabled, customPresets, setCustomPresets } = useUserStore();
  const { toast } = useToast();
  const { createOrder, isReady: privyReady, safeAddress } = useClobClient();
  const { balance, loading: balanceLoading, refetch: refetchBalance } = useUsdcBalance();
  const [amount, setAmount] = useState(target?.initialAmount || 10);

  // Update amount when panel opens with a new initialAmount
  useEffect(() => {
    if (isOpen && target?.initialAmount) {
      setAmount(target.initialAmount);
    }
  }, [isOpen, target?.initialAmount]);

  // Refetch balance when panel opens
  useEffect(() => {
    if (isOpen && isConnected && hasCredentials) {
      refetchBalance();
    }
  }, [isOpen, isConnected, hasCredentials, refetchBalance]);

  const [status, setStatus] = useState<'idle' | 'signing' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [orderId, setOrderId] = useState('');
  const [showPresetEditor, setShowPresetEditor] = useState(false);
  const [editPresets, setEditPresets] = useState<number[]>(customPresets);
  const [showTpSl, setShowTpSl] = useState(false);
  const [customTp, setCustomTp] = useState<number | null>(null);
  const [customSl, setCustomSl] = useState<number | null>(null);

  // Resolved tokens + prices from Gamma API
  const [resolvedTokens, setResolvedTokens] = useState<{ yes: string; no: string } | null>(null);
  const [resolvedPrices, setResolvedPrices] = useState<{ yes: number; no: number } | null>(null);
  const [resolvingTokens, setResolvingTokens] = useState(false);

  // Resolve missing tokens + fetch live prices via server-side proxy when panel opens
  // NOTE: We use /api/dashboard/picks/prices instead of calling Gamma API directly
  // because Gamma has no CORS headers — browser blocks direct client-side requests.
  useEffect(() => {
    if (!isOpen || !target) { setResolvedTokens(null); setResolvedPrices(null); setResolvingTokens(false); return; }

    // Prefer slug for lookups — condition_id can match wrong markets on Gamma
    const slug = target.type === 'pick' ? target.pick?.slug : null;
    const marketId = target.type === 'pick' ? target.pick?.market_id :
                     target.type === 'market' ? target.market?.market_id :
                     target.type === 'signal' ? target.signal?.market_id : null;
    const lookupId = slug || marketId;
    if (!lookupId) { console.warn('[TradePanel] No slug or market_id available for token resolution'); return; }

    let cancelled = false;
    setResolvingTokens(true);
    (async () => {
      try {
        console.log('[TradePanel] Resolving tokens via server proxy for:', lookupId);
        const res = await fetch(`/api/dashboard/picks/prices?ids=${encodeURIComponent(lookupId)}`);
        if (!res.ok || cancelled) {
          console.warn('[TradePanel] Price API returned:', res.status);
          if (!cancelled) setResolvingTokens(false);
          return;
        }
        const data = await res.json();
        const market = data.prices?.[lookupId];

        if (!market || cancelled) {
          console.warn('[TradePanel] No market data returned for:', lookupId);
          if (!cancelled) setResolvingTokens(false);
          return;
        }

        console.log('[TradePanel] Resolved:', {
          lookupId,
          yes: market.yes,
          no: market.no,
          yesToken: market.yesToken?.slice(0, 20) + '...',
          noToken: market.noToken?.slice(0, 20) + '...',
        });

        // Set resolved tokens
        if (market.yesToken && market.noToken && !cancelled) {
          setResolvedTokens({ yes: market.yesToken, no: market.noToken });
        }

        // Set resolved prices
        if ((market.yes > 0 || market.no > 0) && !cancelled) {
          setResolvedPrices({
            yes: market.yes || 0.5,
            no: market.no || 0.5,
          });
        }
      } catch (err) {
        console.warn('[TradePanel] Token resolution failed:', err);
      } finally {
        if (!cancelled) setResolvingTokens(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, target]);

  const insufficientBalance = balance !== null && balance < amount;

  // Initialize TP/SL from AI suggestion when panel opens
  const aiTp = target?.type === 'pick' ? target.pick?.target_price : null;
  const aiSl = target?.type === 'pick' ? target.pick?.stop_loss : null;
  const effectiveTp = customTp ?? aiTp ?? null;
  const effectiveSl = customSl ?? aiSl ?? null;

  /** Resolve tokenId and price from the current trade target, using server-resolved tokens + prices as fallback */
  const resolveTarget = (t: TradeTarget): { tokenId: string; price: number } | null => {
    if (t.type === 'pick' && t.pick?.market) {
      // Prefer server-resolved tokens (from /api/dashboard/picks/prices), fall back to PickCard's tokens
      const yesToken = resolvedTokens?.yes || t.pick.market.yes_token || '';
      const noToken = resolvedTokens?.no || t.pick.market.no_token || '';
      const yesPrice = resolvedPrices?.yes ?? t.pick.market.yes_price;
      const noPrice = resolvedPrices?.no ?? t.pick.market.no_price;

      const result = t.side === 'YES'
        ? { tokenId: yesToken, price: yesPrice }
        : { tokenId: noToken, price: noPrice };

      console.log('[TradePanel] resolveTarget:', {
        side: t.side,
        yesToken: yesToken ? yesToken.slice(0, 20) + '...' : '(empty)',
        noToken: noToken ? noToken.slice(0, 20) + '...' : '(empty)',
        resolvedTokens: !!resolvedTokens,
        pickMarketTokens: { yes: !!t.pick.market.yes_token, no: !!t.pick.market.no_token },
        yesPrice,
        noPrice,
        chosen: result.tokenId ? result.tokenId.slice(0, 20) + '...' : '(EMPTY - will fail)',
      });

      return result;
    }
    if (t.type === 'signal' && t.signal) {
      const tokenId = t.side === 'YES'
        ? (t.signal.market?.yes_token || resolvedTokens?.yes)
        : (t.signal.market?.no_token || resolvedTokens?.no);
      const price = t.side === 'YES'
        ? (resolvedPrices?.yes ?? t.signal.market?.yes_price ?? t.signal.price)
        : (resolvedPrices?.no ?? t.signal.market?.no_price ?? t.signal.price);
      if (!tokenId) return null;
      return { tokenId, price };
    }
    if (t.type === 'market' && t.market) {
      const yesToken = t.market.yes_token || resolvedTokens?.yes || '';
      const noToken = t.market.no_token || resolvedTokens?.no || '';
      const yesPrice = resolvedPrices?.yes ?? t.market.yes_price;
      const noPrice = resolvedPrices?.no ?? t.market.no_price;
      return t.side === 'YES'
        ? { tokenId: yesToken, price: yesPrice }
        : { tokenId: noToken, price: noPrice };
    }
    return null;
  };

  // Quick execute on preset click (Privy signer — no MetaMask popup)
  const handleQuickTrade = async (amt: number) => {
    if (!target || !walletAddress) return;
    if (!createOrder) {
      toast('error', 'Not Ready', 'Trading session not initialized. Connect wallet and try again.');
      return;
    }
    const resolved = resolveTarget(target);
    if (!resolved) {
      toast('error', 'Trade Failed', 'Could not resolve market data');
      return;
    }
    if (!resolved.tokenId) {
      toast('error', 'Trade Failed', 'Token ID not available for this market. Try again in a moment.');
      return;
    }
    try {
      const result = await createOrder({
        tokenID: resolved.tokenId,
        side: 'BUY',
        size: amt / resolved.price,
        price: resolved.price,
      });

      // Check for CLOB-level rejections (returned in response body, not thrown)
      if (result?.errorMsg || result?.error) {
        console.error('[TradePanel] CLOB rejected order:', result.errorMsg || result.error);
        toast('error', 'Order Rejected', result.errorMsg || result.error || 'Unknown CLOB error');
        return;
      }

      // Log the trade server-side
      await fetch('/api/trade/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: safeAddress || walletAddress,
          tokenId: resolved.tokenId,
          direction: target.side,
          amount: amt,
          price: resolved.price,
          orderId: result?.orderID || result?.id || '',
          source: target.type,
          sourceId: target.type === 'pick' ? target.pick?.id : target.signal?.id,
          marketSlug: target.pick?.slug || target.signal?.market_id || null,
        }),
      }).catch(() => {}); // Best-effort logging
      toast('success', 'Order Placed!', `$${amt} trade executed`);
      refetchBalance();
      closeTrade();
    } catch (err: any) {
      if (err.code === 4001 || err.message?.includes('rejected')) {
        toast('error', 'Trade Cancelled', 'Transaction rejected in wallet');
      } else {
        console.error('[TradePanel] Trade error:', err);
        toast('error', 'Trade Failed', err.message || 'Something went wrong');
      }
    }
  };

  const handleExecute = async () => {
    if (!target) return;
    if (!createOrder) {
      setStatus('error');
      setErrorMsg('Trading session not ready. Please connect your wallet and try again.');
      return;
    }

    setErrorMsg('');

    const resolved = resolveTarget(target);
    if (!resolved) {
      setStatus('error');
      setErrorMsg('Market data missing — cannot place order');
      return;
    }
    if (!resolved.tokenId) {
      setStatus('error');
      setErrorMsg('Token ID not available for this market');
      return;
    }

    setStatus('signing');

    try {
      const result = await createOrder({
        tokenID: resolved.tokenId,
        side: 'BUY',
        size: amount / resolved.price,
        price: resolved.price,
      });

      // Check for CLOB-level rejections (returned in response body, not thrown)
      if (result?.errorMsg || result?.error) {
        console.error('[TradePanel] CLOB rejected order:', result.errorMsg || result.error);
        setStatus('error');
        setErrorMsg(result.errorMsg || result.error || 'Order rejected by CLOB');
        return;
      }

      const resultOrderId = result?.orderID || result?.id || '';

      // Log the trade server-side
      await fetch('/api/trade/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: safeAddress || walletAddress,
          tokenId: resolved.tokenId,
          direction: target.side,
          amount,
          price: resolved.price,
          orderId: resultOrderId,
          source: target.type,
          sourceId: target.type === 'pick' ? target.pick?.id : target.signal?.id,
          marketSlug: target.pick?.slug || target.signal?.market_id || null,
        }),
      }).catch(() => {}); // Best-effort logging

      setStatus('success');
      setOrderId(typeof resultOrderId === 'string' ? resultOrderId : JSON.stringify(resultOrderId));
      refetchBalance();

      // Save TP/SL alongside the trade if set
      // Small delay to ensure /api/trade/log INSERT completes first (PATCH matches by order_id)
      if (effectiveTp || effectiveSl) {
        setTimeout(() => {
          fetch('/api/trade/execute', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderID: resultOrderId,
              walletAddress: safeAddress || walletAddress,
              takeProfit: effectiveTp,
              stopLoss: effectiveSl,
            }),
          }).catch((err) => console.error('[TradePanel] TP/SL save failed:', err));
        }, 1500);
      }

      // Auto-close after success
      setTimeout(() => {
        resetAndClose();
      }, 2500);
    } catch (err: any) {
      console.error('[TradePanel] Trade error:', err);
      setStatus('error');
      if (err.code === 4001 || err.message?.includes('rejected')) {
        setErrorMsg('Transaction rejected in wallet');
      } else {
        setErrorMsg(err.message || 'Something went wrong');
      }
    }
  };

  const resetAndClose = () => {
    closeTrade();
    setStatus('idle');
    setAmount(10);
    setErrorMsg('');
    setOrderId('');
    setShowTpSl(false);
    setCustomTp(null);
    setCustomSl(null);
  };

  // Calculate estimated payout — prefer live prices from Gamma
  const getPrice = () => {
    if (resolvedPrices) {
      return target?.side === 'YES' ? resolvedPrices.yes : resolvedPrices.no;
    }
    if (target?.type === 'pick' && target.pick?.market) {
      return target.side === 'YES'
        ? target.pick.market.yes_price
        : target.pick.market.no_price;
    }
    if (target?.type === 'signal' && target.signal) {
      return target.signal.price;
    }
    return 0.5;
  };

  const price = getPrice();
  const shares = price > 0 ? amount / price : 0;
  const potentialPayout = shares; // Each share pays $1 if correct
  const potentialProfit = potentialPayout - amount;

  return (
    <AnimatePresence>
      {isOpen && target && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={resetAndClose}
          />

          {/* Panel */}
          <motion.div
            className="fixed right-0 top-0 bottom-0 z-[70] w-full max-w-md bg-ep-bg border-l border-ep-border overflow-y-auto"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 glass border-b border-ep-border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    target.side === 'YES' ? 'bg-profit' : 'bg-loss'
                  }`} />
                  <h2 className="font-display text-lg font-bold">
                    {target.type === 'signal' ? 'Copy Trade' : 'Place Trade'}
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  {/* USDC Balance */}
                  {isConnected && hasCredentials && (
                    <div className="flex items-center gap-1 text-[11px] font-mono text-text-muted">
                      {balanceLoading ? (
                        <span className="animate-pulse">...</span>
                      ) : balance !== null ? (
                        <span className={insufficientBalance ? 'text-loss' : 'text-text-secondary'}>
                          ${balance.toFixed(2)}
                        </span>
                      ) : null}
                    </div>
                  )}
                  {/* Quick Trade toggle */}
                  {isConnected && hasCredentials && (
                    <button
                      onClick={() => setQuickTradeEnabled(!quickTradeEnabled)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider transition ${
                        quickTradeEnabled
                          ? 'bg-accent/15 text-accent border border-accent/30'
                          : 'bg-ep-surface text-text-muted border border-ep-border hover:border-accent/20'
                      }`}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Quick
                    </button>
                  )}
                  <button
                    onClick={resetAndClose}
                    className="btn-ghost w-8 h-8 flex items-center justify-center rounded-lg"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-6">
              {/* ── Market Info ─────────────────── */}
              <div className="ep-card p-4">
                {target.type === 'pick' && target.pick && (
                  <>
                    <div className="flex items-start gap-3 mb-3">
                      <ConvictionGauge score={target.pick.conviction_score} size="sm" />
                      <div>
                        <p className="text-sm font-semibold text-text-primary leading-tight">
                          {target.pick.market?.question || target.pick.market_id}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <DirectionBadge direction={target.side} />
                          <span className="text-xs text-text-muted">
                            {target.pick.risk_reward?.toFixed(1)}x R/R
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Entry (read-only) */}
                    <div className="bg-ep-surface/40 rounded-lg p-2.5 mb-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-text-muted uppercase">Entry Price</span>
                        <span className="font-mono text-sm text-text-primary">
                          {(target.pick.entry_price * 100).toFixed(0)}c
                        </span>
                      </div>
                    </div>

                    {/* TP / SL — editable */}
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowTpSl(!showTpSl)}
                        className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition"
                      >
                        <svg className={`w-3 h-3 transition-transform ${showTpSl ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                        {showTpSl ? 'Hide' : 'Set'} Take Profit & Stop Loss
                      </button>

                      <AnimatePresence>
                        {showTpSl && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-2 gap-3 pt-1">
                              {/* Take Profit */}
                              <div>
                                <label className="text-[10px] text-text-muted uppercase tracking-wider mb-1 block">
                                  Take Profit
                                </label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    value={customTp !== null ? Math.round(customTp * 1000) / 10 : aiTp ? Math.round(aiTp * 1000) / 10 : ''}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      if (val > 0 && val <= 99) setCustomTp(val / 100);
                                      else if (e.target.value === '') setCustomTp(null);
                                    }}
                                    placeholder={aiTp ? `${(aiTp * 100).toFixed(0)}` : '—'}
                                    className="w-full bg-ep-surface border border-profit/30 rounded-lg px-3 py-2 pr-6 font-mono text-sm text-profit focus:outline-none focus:border-profit/50 focus:ring-1 focus:ring-profit/20 transition placeholder:text-profit/30"
                                    min={1}
                                    max={99}
                                    step={1}
                                  />
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-text-muted">c</span>
                                </div>
                                {aiTp && (
                                  <button
                                    onClick={() => setCustomTp(null)}
                                    className="text-[10px] text-text-muted hover:text-profit transition mt-1"
                                  >
                                    AI suggests {(aiTp * 100).toFixed(0)}c
                                  </button>
                                )}
                              </div>

                              {/* Stop Loss */}
                              <div>
                                <label className="text-[10px] text-text-muted uppercase tracking-wider mb-1 block">
                                  Stop Loss
                                </label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    value={customSl !== null ? Math.round(customSl * 1000) / 10 : aiSl ? Math.round(aiSl * 1000) / 10 : ''}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      if (val > 0 && val <= 99) setCustomSl(val / 100);
                                      else if (e.target.value === '') setCustomSl(null);
                                    }}
                                    placeholder={aiSl ? `${(aiSl * 100).toFixed(0)}` : '—'}
                                    className="w-full bg-ep-surface border border-loss/30 rounded-lg px-3 py-2 pr-6 font-mono text-sm text-loss focus:outline-none focus:border-loss/50 focus:ring-1 focus:ring-loss/20 transition placeholder:text-loss/30"
                                    min={1}
                                    max={99}
                                    step={1}
                                  />
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-text-muted">c</span>
                                </div>
                                {aiSl && (
                                  <button
                                    onClick={() => setCustomSl(null)}
                                    className="text-[10px] text-text-muted hover:text-loss transition mt-1"
                                  >
                                    AI suggests {(aiSl * 100).toFixed(0)}c
                                  </button>
                                )}
                              </div>
                            </div>

                            <p className="text-[10px] text-text-muted mt-2 leading-relaxed">
                              We&apos;ll monitor the market and notify you when your TP or SL is hit.
                              Prices are in cents (1c = $0.01).
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </>
                )}

                {target.type === 'signal' && target.signal && (
                  <>
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: 'rgba(0, 240, 160, 0.15)', color: '#00F0A0' }}
                      >
                        {(target.signal.trader?.alias || '?')[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-text-primary">
                            {target.signal.trader?.alias || 'Trader'}
                          </span>
                          {target.signal.trader?.bankroll_tier && (
                            <TierBadge tier={target.signal.trader.bankroll_tier} />
                          )}
                          {target.signal.trader?.trading_style && (
                            <StyleBadge style={target.signal.trader.trading_style} />
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5">
                          <span>ROI <span className="font-mono text-profit">{(target.signal.trader?.roi || 0).toFixed(0)}%</span></span>
                          <span>WR <span className="font-mono">{(target.signal.trader?.win_rate || 0).toFixed(0)}%</span></span>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-text-secondary mb-2">
                      {target.signal.market?.question || target.signal.market_id}
                    </p>
                    <div className="flex items-center gap-2">
                      <DirectionBadge direction={target.side} />
                      <span className="font-mono text-sm text-text-primary">
                        ${target.signal.amount.toFixed(0)} @ {(target.signal.price * 100).toFixed(0)}c
                      </span>
                    </div>
                  </>
                )}

                {target.type === 'market' && target.market && (
                  <>
                    <p className="text-sm font-semibold text-text-primary leading-tight mb-2">
                      {target.market.question}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <span className="font-mono text-text-secondary">
                        YES {(target.market.yes_price * 100).toFixed(0)}¢
                      </span>
                      <span className="opacity-40">·</span>
                      <span className="font-mono text-text-secondary">
                        NO {(target.market.no_price * 100).toFixed(0)}¢
                      </span>
                    </div>

                    {/* Multi-choice outcome picker */}
                    {target.market.outcomes && target.market.outcomes.length > 1 && (
                      <div className="mt-3 pt-3 border-t border-ep-border/50">
                        <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2 block">
                          Choose Outcome
                        </label>
                        <div className="space-y-1 max-h-[200px] overflow-y-auto scrollbar-hide">
                          {target.market.outcomes.map((o) => {
                            const isSelected = target.market!.market_id === o.market_id;
                            const pct = Math.round(o.yes_price * 100);
                            return (
                              <button
                                key={o.market_id}
                                onClick={() => {
                                  // Find parent question (before the " → ")
                                  const parentQ = target.market!.question.split(' → ')[0];
                                  openTrade({
                                    ...target,
                                    market: {
                                      ...target.market!,
                                      market_id: o.market_id,
                                      question: `${parentQ} → ${o.label}`,
                                      yes_price: o.yes_price,
                                      no_price: 1 - o.yes_price,
                                      yes_token: o.yes_token,
                                      no_token: o.no_token,
                                    },
                                  });
                                }}
                                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left transition ${
                                  isSelected
                                    ? 'bg-accent/10 border border-accent/30'
                                    : 'bg-ep-surface/40 border border-transparent hover:border-ep-border'
                                }`}
                              >
                                <span className={`text-xs truncate ${isSelected ? 'text-accent font-semibold' : 'text-text-secondary'}`}>
                                  {o.label}
                                </span>
                                <span className={`text-xs font-mono flex-shrink-0 ${isSelected ? 'text-accent' : 'text-text-muted'}`}>
                                  {pct}%
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* ── Side Toggle ─────────────────── */}
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 block">
                  Direction
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => openTrade({ ...target, side: 'YES' })}
                    className={`flex-1 rounded-lg p-3 text-center font-semibold text-sm border-2 transition cursor-pointer ${
                    target.side === 'YES'
                      ? 'border-profit bg-profit/10 text-profit'
                      : 'border-ep-border/30 bg-ep-surface/30 text-text-muted hover:border-profit/30 hover:text-profit/60'
                  }`}>
                    YES
                  </button>
                  <button
                    onClick={() => openTrade({ ...target, side: 'NO' })}
                    className={`flex-1 rounded-lg p-3 text-center font-semibold text-sm border-2 transition cursor-pointer ${
                    target.side === 'NO'
                      ? 'border-loss bg-loss/10 text-loss'
                      : 'border-ep-border/30 bg-ep-surface/30 text-text-muted hover:border-loss/30 hover:text-loss/60'
                  }`}>
                    NO
                  </button>
                </div>
              </div>

              {/* ── Amount Input ────────────────── */}
              <div>
                <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 block">
                  Amount (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-mono">$</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Math.max(1, Math.min(1000, Number(e.target.value))))}
                    className="w-full bg-ep-surface border border-ep-border rounded-lg px-8 py-3 font-mono text-lg text-text-primary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition"
                    min={1}
                    max={1000}
                  />
                </div>
                {/* Preset chips */}
                <div className="flex gap-2 mt-2">
                  {customPresets.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => {
                        if (quickTradeEnabled && isConnected && hasCredentials) {
                          handleQuickTrade(preset);
                        } else {
                          setAmount(preset);
                        }
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-medium transition relative ${
                        quickTradeEnabled && isConnected && hasCredentials
                          ? 'bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20'
                          : amount === preset
                          ? 'bg-accent/15 text-accent border border-accent/30'
                          : 'bg-ep-surface border border-ep-border text-text-secondary hover:border-accent/20'
                      }`}
                    >
                      {quickTradeEnabled && isConnected && hasCredentials && (
                        <svg className="w-2.5 h-2.5 inline mr-0.5 -mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      )}
                      ${preset}
                    </button>
                  ))}
                </div>
                {/* Customize presets */}
                <div className="mt-1.5">
                  <button
                    onClick={() => {
                      setEditPresets(customPresets);
                      setShowPresetEditor(!showPresetEditor);
                    }}
                    className="text-[10px] text-text-muted hover:text-accent transition"
                  >
                    {showPresetEditor ? 'Cancel' : 'Customize presets'}
                  </button>
                  <AnimatePresence>
                    {showPresetEditor && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="flex gap-1.5 mt-2">
                          {editPresets.map((p, i) => (
                            <input
                              key={i}
                              type="number"
                              value={p}
                              onChange={(e) => {
                                const next = [...editPresets];
                                next[i] = Math.max(1, Math.min(1000, Number(e.target.value)));
                                setEditPresets(next);
                              }}
                              className="flex-1 w-0 px-1.5 py-1 text-[11px] font-mono text-center bg-ep-surface border border-ep-border rounded-md text-text-primary focus:outline-none focus:border-accent/40"
                              min={1}
                              max={1000}
                            />
                          ))}
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => {
                              setCustomPresets(editPresets);
                              setShowPresetEditor(false);
                            }}
                            className="text-[10px] font-semibold text-accent hover:underline"
                          >
                            Apply
                          </button>
                          <button
                            onClick={() => {
                              setEditPresets([5, 10, 25, 50, 100]);
                              setCustomPresets([5, 10, 25, 50, 100]);
                              setShowPresetEditor(false);
                            }}
                            className="text-[10px] text-text-muted hover:text-text-secondary"
                          >
                            Reset defaults
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* ── Order Summary ───────────────── */}
              <div className="ep-card p-4 space-y-2">
                <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Order Summary
                </h3>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Side</span>
                  <span className={`font-semibold ${target.side === 'YES' ? 'text-profit' : 'text-loss'}`}>
                    BUY {target.side}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Amount</span>
                  <span className="font-mono text-text-primary">${amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Price</span>
                  <span className="font-mono text-text-primary">{(price * 100).toFixed(1)}c</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Est. Shares</span>
                  <span className="font-mono text-text-primary">{shares.toFixed(1)}</span>
                </div>
                {/* TP / SL summary */}
                {(effectiveTp || effectiveSl) && (
                  <>
                    {effectiveTp && (
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">Take Profit</span>
                        <span className="font-mono text-profit">{(effectiveTp * 100).toFixed(0)}c</span>
                      </div>
                    )}
                    {effectiveSl && (
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">Stop Loss</span>
                        <span className="font-mono text-loss">{(effectiveSl * 100).toFixed(0)}c</span>
                      </div>
                    )}
                  </>
                )}
                <div className="border-t border-ep-border pt-2 mt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">If correct</span>
                    <span className="font-mono font-bold text-profit">
                      +${potentialProfit.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">If wrong</span>
                    <span className="font-mono font-bold text-loss">
                      -${amount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Insufficient Balance Warning ── */}
              {insufficientBalance && (
                <motion.div
                  className="p-3 rounded-lg bg-loss/10 border border-loss/20 flex items-start gap-2"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <svg className="w-4 h-4 text-loss shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <div>
                    <p className="text-sm text-loss font-medium">Insufficient Balance</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      You have ${balance?.toFixed(2)} but need ${amount.toFixed(2)}. Deposit USDC.e to continue.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* ── Execute Button ──────────────── */}
              {!isConnected || !walletAddress || !hasCredentials ? (
                /* Wallet guard — must connect before trading */
                <div className="ep-card p-5 text-center space-y-3">
                  <div className="text-2xl">🔗</div>
                  <p className="text-sm text-text-secondary">
                    Connect your wallet to start trading
                  </p>
                  <p className="text-xs text-text-muted">
                    Your funds stay in your Polymarket wallet.
                    We never hold your money.
                  </p>
                  <WalletConnectButton variant="inline" />
                </div>
              ) : status === 'success' ? (
                <motion.div
                  className="ep-card p-6 text-center border-profit/30"
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                >
                  <div className="text-3xl mb-2">&#10003;</div>
                  <h3 className="font-display font-bold text-profit text-lg">Order Placed!</h3>
                  <p className="text-sm text-text-muted mt-1">
                    BUY {target.side} · ${amount} at {(price * 100).toFixed(0)}c
                  </p>
                  {orderId && (
                    <p className="text-xs text-text-muted mt-2 font-mono">
                      Order: {orderId.slice(0, 12)}...
                    </p>
                  )}
                </motion.div>
              ) : (
                <>
                  <ActionButton
                    variant={target.side === 'YES' ? 'yes' : 'no'}
                    size="lg"
                    fullWidth
                    onClick={handleExecute}
                    state={resolvingTokens ? 'loading' : !privyReady ? 'idle' : status === 'signing' || status === 'submitting' ? 'loading' : status}
                    disabled={resolvingTokens || !privyReady}
                  >
                    {resolvingTokens
                      ? 'Resolving market...'
                      : !privyReady
                      ? 'Initializing...'
                      : status === 'signing'
                      ? 'Signing Order...'
                      : status === 'submitting'
                      ? 'Placing Order...'
                      : `BUY ${target.side} · $${amount}`
                    }
                  </ActionButton>

                  {status === 'error' && (
                    <motion.div
                      className="p-3 rounded-lg bg-loss/10 border border-loss/20"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <p className="text-sm text-loss font-medium">Order Failed</p>
                      <p className="text-xs text-text-muted mt-0.5">{errorMsg}</p>
                      <button
                        onClick={() => setStatus('idle')}
                        className="text-xs text-accent mt-2 hover:underline"
                      >
                        Try Again
                      </button>
                    </motion.div>
                  )}
                </>
              )}

              {/* ── AI Reasoning (for picks) ───── */}
              {target.type === 'pick' && target.pick?.edge_explanation && (
                <div className="ep-card p-4">
                  <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                    AI Analysis
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {target.pick.edge_explanation}
                  </p>
                </div>
              )}

              {/* ── Ask AI ──────────────────────── */}
              <AskAI
                contextPrompt={
                  target.type === 'pick' && target.pick
                    ? `Should I buy ${target.side} on "${target.pick.market?.question || target.pick.market_id}" at ${(target.pick.entry_price * 100).toFixed(0)}c? Conviction ${target.pick.conviction_score}/100. Target ${(target.pick.target_price * 100).toFixed(0)}c, stop ${(target.pick.stop_loss * 100).toFixed(0)}c. Risk/reward: ${target.pick.risk_reward.toFixed(1)}x.`
                    : target.type === 'signal' && target.signal
                    ? `Trader${target.signal.trader ? ` "${target.signal.trader.alias}" with ${target.signal.trader.roi.toFixed(0)}% ROI and ${(target.signal.trader.win_rate * 100).toFixed(0)}% win rate` : ''} bought ${target.signal.direction} on "${target.signal.market?.question || target.signal.market_id}" at ${(target.signal.price * 100).toFixed(0)}c for $${target.signal.amount.toFixed(0)}. Should I copy this trade?`
                    : `Analyze this ${target.side} trade opportunity.`
                }
                marketQuestion={
                  target.pick?.market?.question ||
                  target.signal?.market?.question ||
                  'this market'
                }
                compact
              />

              {/* ── Disclaimer ──────────────────── */}
              <p className="text-[10px] text-text-muted text-center leading-relaxed pb-4">
                Trading involves risk. Only trade with funds you can afford to lose.
                Déjà does not provide financial advice. Orders are signed
                in your wallet and executed on the Polymarket CLOB.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
