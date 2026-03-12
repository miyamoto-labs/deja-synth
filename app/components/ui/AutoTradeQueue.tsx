'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DirectionBadge, TierBadge } from './Badges';
import { useToast } from './Toast';
import { useUserStore } from '@/app/lib/stores/user-store';
import { useTradeExecution } from '@/app/lib/hooks/useTradeExecution';
import { useClobClient } from '@/app/lib/hooks/useClobClient';
import { useUsdcBalance } from '@/app/lib/hooks/useUsdcBalance';

/* ── Types ──────────────────────────────────────── */
interface PendingTrade {
  signalId: string;
  traderId: string;
  traderAlias: string;
  traderRoi: number;
  traderWinRate: number;
  traderTier: string;
  traderStyle: string;
  marketId: string;
  marketQuestion: string;
  marketCategory: string;
  direction: string;
  traderAmount: number;
  traderPrice: number;
  currentYesPrice: number;
  currentNoPrice: number;
  yesToken: string;
  noToken: string;
  suggestedAmount: number;
  sizingMode: string;       // 'fixed' or 'percentage' — from follow settings
  sizingValue: number;      // default $ amount or % value
  maxPerTrade: number;      // cap for percentage mode (0 = no limit)
  timestamp: string;
  manual?: boolean;
}

interface QueueStats {
  dailyUsed: number;
  dailyLimit: number;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ── Component ──────────────────────────────────── */
export function AutoTradeQueue() {
  const { walletAddress, isConnected, follows } = useUserStore();
  const { executeTrade } = useTradeExecution();
  const { createOrder: privyCreateOrder, isReady: privyReady, safeAddress } = useClobClient();
  const { balance: usdcBalance, formatted: balanceFormatted, refetch: refetchBalance } = useUsdcBalance();
  const { toast } = useToast();

  const [pending, setPending] = useState<PendingTrade[]>([]);
  const [stats, setStats] = useState<QueueStats>({ dailyUsed: 0, dailyLimit: 0 });
  const [loading, setLoading] = useState(true);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [executingAll, setExecutingAll] = useState(false);
  const [autoExecuting, setAutoExecuting] = useState(false);

  // Per-trade sizing overrides: user can adjust mode ($ vs %) and value inline
  const [overrides, setOverrides] = useState<Record<string, { mode: 'fixed' | 'percent'; value: number }>>({});

  const setOverride = (signalId: string, patch: Partial<{ mode: 'fixed' | 'percent'; value: number }>) => {
    setOverrides((prev) => ({
      ...prev,
      [signalId]: { ...prev[signalId], ...patch } as { mode: 'fixed' | 'percent'; value: number },
    }));
  };

  /** Compute the effective $ amount for a trade, respecting inline overrides */
  const getEffectiveAmount = (trade: PendingTrade): number => {
    const override = overrides[trade.signalId];
    const mode = override?.mode ?? (trade.sizingMode === 'percentage' ? 'percent' : 'fixed');
    const value = override?.value ?? trade.sizingValue;
    if (mode === 'percent') {
      let amt = Math.round((trade.traderAmount * value) / 100);
      if (trade.maxPerTrade && amt > trade.maxPerTrade) amt = trade.maxPerTrade;
      return Math.max(amt, 1);
    }
    return Math.max(value, 1);
  };

  // Track signals we've already attempted to auto-execute (prevents double-firing)
  const attemptedRef = useRef<Set<string>>(new Set());
  const autoExecutingRef = useRef(false);
  const handleExecuteRef = useRef<((trade: PendingTrade, isAutoExec?: boolean) => Promise<void>) | null>(null);
  const pendingIdsRef = useRef<Set<string>>(new Set());

  // Show if user has ANY active follow (auto or manual)
  const hasActiveFollows = follows.length > 0;

  // Track active trader IDs from the store — follows only includes active=true traders
  const activeTraderIds = useMemo(() => new Set(follows.map((f) => f.traderId)), [follows]);

  // Fingerprint: changes when follows list changes (trader added/removed/mode changed)
  const followsKey = useMemo(() => follows.map((f) => `${f.traderId}:${f.autoTrade}`).sort().join(','), [follows]);

  // Client-side filtered pending: only signals from currently-active traders, capped at 20
  const MAX_QUEUE_SIZE = 20;
  const visiblePending = useMemo(
    () => pending.filter((t) => activeTraderIds.has(t.traderId)).slice(0, MAX_QUEUE_SIZE),
    [pending, activeTraderIds],
  );

  const fetchQueue = useCallback(async () => {
    if (!walletAddress || !hasActiveFollows) return;
    try {
      const res = await fetch(`/api/auto-trade/queue?wallet=${walletAddress}`);
      if (res.ok) {
        const data = await res.json();
        const newPending: PendingTrade[] = data.pendingTrades || [];

        // Toast for new manual signals from active traders only (after initial load)
        if (pendingIdsRef.current.size > 0) {
          const newManual = newPending.filter(
            (t) => t.manual && !pendingIdsRef.current.has(t.signalId) && activeTraderIds.has(t.traderId),
          );
          if (newManual.length > 0) {
            const first = newManual[0];
            toast(
              'signal',
              `${first.traderAlias} traded`,
              `${first.direction} on ${first.marketQuestion.slice(0, 50)} — review in queue`,
            );
          }
        }

        // Update ref for next comparison
        pendingIdsRef.current = new Set(newPending.map((t) => t.signalId));
        setPending(newPending);
        setStats(data.stats || { dailyUsed: 0, dailyLimit: 0 });
      }
    } catch (err) {
      console.error('Auto-trade queue fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, hasActiveFollows, toast, activeTraderIds]);

  useEffect(() => {
    if (!isConnected || !walletAddress || !hasActiveFollows) {
      setLoading(false);
      setPending([]);        // Clear stale trades when all follows are off
      setOverrides({});      // Clear overrides too
      return;
    }
    fetchQueue();
    // Poll every 5s for fast auto-trade execution (trades execute browser-side)
    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
    // followsKey triggers immediate re-fetch when a trader is toggled on/off/auto/manual
  }, [fetchQueue, isConnected, walletAddress, hasActiveFollows, followsKey]);

  // ── Auto-execution: fire trades automatically when Privy is ready ──
  // Must be declared before early returns to satisfy React rules of hooks.
  // Uses handleExecuteRef because handleExecute is defined after the early returns.
  // We use a readyToAutoExec flag that flips on once handleExecuteRef is populated.
  const [readyToAutoExec, setReadyToAutoExec] = useState(false);

  // Sync the ref after every render (even if early-returned last time)
  useEffect(() => {
    if (handleExecuteRef.current && !readyToAutoExec) {
      setReadyToAutoExec(true);
    }
  });

  // Browser auto-execute is DISABLED — the server-side copytrade processor
  // handles auto-trade execution via residential proxy (CLOB_PROXY_URL).
  // The browser queue only shows signals for manual "Trade $X" clicks.
  // Keeping the hooks/refs above to satisfy React rules of hooks.

  // Don't render if not connected or no follows at all
  if (!isConnected || !hasActiveFollows) return null;
  if (loading) return null;

  // Show empty state when no pending signals (instead of hiding completely)
  if (visiblePending.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h2 className="font-display text-lg font-bold">Trade Queue</h2>
          <span className="rounded-full bg-ep-surface px-2 py-0.5 text-[11px] font-bold text-text-muted">0</span>
        </div>
        <div className="ep-card p-6 text-center">
          <p className="text-sm text-text-muted">No pending signals</p>
          <p className="text-xs text-text-muted/60 mt-1">
            Waiting for your followed traders to make moves...
          </p>
        </div>
      </div>
    );
  }

  // Check if balance is too low for any trade (uses effective amounts for manual, suggestedAmount for auto)
  const cheapestTrade = Math.min(...visiblePending.map((t) => t.manual ? getEffectiveAmount(t) : t.suggestedAmount));
  const hasInsufficientBalance = usdcBalance !== null && usdcBalance < cheapestTrade;

  const handleExecute = async (trade: PendingTrade, isAutoExec = false, overrideAmount?: number) => {
    // overrideAmount allows inline sizing controls to pass a custom amount
    // Auto-exec always uses suggestedAmount (no override)
    const amount = overrideAmount ?? trade.suggestedAmount;

    setExecutingId(trade.signalId);
    try {
      // ── Pre-check USDC balance ──
      if (usdcBalance === null) {
        refetchBalance();
        toast('error', 'Balance Unknown', 'Could not verify your USDC balance. Please try again.');
        return;
      }
      if (usdcBalance < amount) {
        toast(
          'error',
          'Insufficient Balance',
          `Need $${amount} but have ${balanceFormatted}. Deposit more USDC.`
        );
        return;
      }

      const price =
        trade.direction === 'YES' ? trade.currentYesPrice : trade.currentNoPrice;

      if (!price || price <= 0) {
        toast('error', 'Trade Failed', 'Market price unavailable');
        return;
      }

      // Resolve the actual CLOB token ID (not the market slug)
      const tokenID = trade.direction === 'YES' ? trade.yesToken : trade.noToken;
      if (!tokenID) {
        toast('error', 'Trade Failed', 'Token ID not available for this market');
        return;
      }

      // Ensure the order meets the CLOB's $1 minimum after rounding
      const effectiveAmount = Math.max(amount, 1.01);
      const rawSize = effectiveAmount / price;
      const size = Math.ceil(rawSize * 100) / 100; // Round up to 2 decimals
      let orderSuccess = false;
      let orderId: string | undefined;
      let errorMsg: string | undefined;

      // ── Try Privy silent signing first (no popup) ──
      if (privyReady && privyCreateOrder) {
        try {
          console.log(`[AutoTrade] Using Privy signing for signal ${trade.signalId}`);
          const result = await privyCreateOrder({
            tokenID: tokenID,
            side: 'BUY',
            size,
            price,
          });
          console.log('[AutoTrade] Privy order result:', JSON.stringify(result));

          if (result?.errorMsg || result?.error) {
            errorMsg = result.errorMsg || result.error;
            console.error('[AutoTrade] CLOB rejected order:', errorMsg);
          } else {
            orderSuccess = true;
            orderId = result?.orderID || result?.id;
          }
        } catch (err: any) {
          console.error('[AutoTrade] Privy execution failed:', err?.message);
          errorMsg = err?.message || 'Privy signing failed';
        }
      }

      // ── Fallback: MetaMask signing (requires popup) ──
      // Only for manual button clicks — never during auto-execution
      if (!orderSuccess && !privyReady && !isAutoExec) {
        console.log(`[AutoTrade] Using MetaMask fallback for signal ${trade.signalId}`);
        const result = await executeTrade({
          tokenId: tokenID,
          side: 'BUY',
          amount,
          price,
          direction: trade.direction,
          source: 'auto-trade',
          sourceId: trade.signalId,
          marketSlug: trade.marketId,
        });

        if (result.success) {
          orderSuccess = true;
          orderId = result.orderID;
        } else {
          errorMsg = result.error || 'Something went wrong';
        }
      }

      // If auto-exec and Privy not ready, skip silently — trade stays in queue for manual execution
      if (!orderSuccess && isAutoExec && !privyReady) {
        console.log(`[AutoTrade] Privy not ready, skipping auto-exec for signal ${trade.signalId}. Trade remains in queue.`);
        return;
      }

      if (orderSuccess) {
        // Log the execution
        await fetch('/api/auto-trade/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet: safeAddress || walletAddress,
            signalId: trade.signalId,
            traderId: trade.traderId,
            orderId: orderId || 'unknown',
            amount,
          }),
        });

        // Also log to server trade history
        try {
          await fetch('/api/trade/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              walletAddress: safeAddress || walletAddress,
              tokenId: tokenID,
              side: 'BUY',
              direction: trade.direction,
              amount,
              price,
              orderId: orderId || 'unknown',
              source: 'auto-trade',
              sourceId: trade.signalId,
              marketSlug: trade.marketId,
            }),
          });
        } catch {
          // Non-critical — continue even if server log fails
        }

        toast('success', 'Trade Executed!', `$${amount} ${trade.direction} placed`);

        // Remove from pending and refresh balance for next trade
        setPending((prev) => prev.filter((p) => p.signalId !== trade.signalId));
        setOverrides((prev) => { const next = { ...prev }; delete next[trade.signalId]; return next; });
        setStats((prev) => ({ ...prev, dailyUsed: prev.dailyUsed + 1 }));
        refetchBalance();
      } else {
        toast('error', 'Trade Failed', errorMsg || 'Something went wrong');
      }
    } catch (err: any) {
      toast('error', 'Trade Failed', err.message || 'Something went wrong');
    } finally {
      setExecutingId(null);
    }
  };

  // Keep ref in sync so the auto-execute useEffect can call it
  handleExecuteRef.current = handleExecute;

  const handleDismiss = async (trade: PendingTrade) => {
    try {
      await fetch('/api/auto-trade/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletAddress,
          signalId: trade.signalId,
        }),
      });
      setPending((prev) => prev.filter((p) => p.signalId !== trade.signalId));
    } catch {
      // Silent fail — they can dismiss again
    }
  };

  const handleExecuteAll = async () => {
    // Pre-check total cost against balance (using effective amounts)
    const totalCost = visiblePending.reduce((s, t) => s + getEffectiveAmount(t), 0);
    if (usdcBalance === null) {
      refetchBalance();
      toast('error', 'Balance Unknown', 'Could not verify your USDC balance. Please try again.');
      return;
    }
    if (usdcBalance < totalCost) {
      const shortfall = (totalCost - usdcBalance).toFixed(2);
      toast(
        'error',
        'Insufficient Balance',
        `Need $${totalCost} for all trades but have ${balanceFormatted}. Deposit $${shortfall} more USDC.`
      );
      return;
    }

    setExecutingAll(true);
    for (const trade of visiblePending) {
      await handleExecute(trade, false, getEffectiveAmount(trade));
      // Small delay between trades to avoid rate limiting
      await new Promise((r) => setTimeout(r, 500));
    }
    setExecutingAll(false);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <h2 className="font-display text-lg font-bold">
              {visiblePending.some((t) => t.manual) ? 'Trade Queue' : 'Auto-Trade Queue'}
            </h2>
            {autoExecuting && (
              <span className="flex items-center gap-1 text-[11px] text-accent font-medium">
                <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Executing...
              </span>
            )}
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent">
              {visiblePending.length}
            </span>
          </div>

          {/* Daily limit */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-text-muted">
            <div className="w-16 h-1.5 bg-ep-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{
                  width: `${stats.dailyLimit > 0 ? (stats.dailyUsed / stats.dailyLimit) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="font-mono">
              {stats.dailyUsed}/{stats.dailyLimit} today
            </span>
          </div>

          {/* Balance indicator */}
          {usdcBalance !== null && (
            <div className={`hidden sm:flex items-center gap-1 text-xs font-mono ${
              usdcBalance < visiblePending.reduce((s, t) => s + getEffectiveAmount(t), 0)
                ? 'text-loss'
                : 'text-text-muted'
            }`}>
              <span>{balanceFormatted}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {visiblePending.length > 1 && (
            <button
              onClick={handleExecuteAll}
              disabled={executingAll || hasInsufficientBalance}
              className="btn-accent text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50"
            >
              {executingAll ? 'Executing...' : `Execute All (${visiblePending.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Jump to Traders — centered, prominent */}
      {visiblePending.length > 3 && (
        <div className="flex justify-center -mt-1 mb-1">
          <button
            onClick={() => document.getElementById('traders-section')?.scrollIntoView({ behavior: 'smooth' })}
            className="text-xs px-5 py-2 rounded-xl font-semibold text-accent border border-accent/30 bg-accent/5 hover:bg-accent/15 hover:border-accent/50 transition-all"
          >
            ↓ Jump to Traders
          </button>
        </div>
      )}

      {/* Insufficient Balance Banner */}
      {hasInsufficientBalance && (
        <div className="flex items-center gap-2 rounded-lg bg-loss/10 border border-loss/20 px-4 py-2.5 text-sm text-loss">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>
            Insufficient balance ({balanceFormatted}). Deposit USDC.e to auto-trade.
          </span>
        </div>
      )}

      {/* Pending Trade Cards */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {visiblePending.map((trade, i) => {
            const isExecuting = executingId === trade.signalId;
            const currentPrice =
              trade.direction === 'YES'
                ? trade.currentYesPrice
                : trade.currentNoPrice;

            return (
              <motion.div
                key={trade.signalId}
                className="ep-card p-4"
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 60, height: 0, marginBottom: 0, padding: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left: signal info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {/* Trader avatar */}
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                        style={{
                          background: 'rgba(0, 240, 160, 0.15)',
                          color: '#00F0A0',
                        }}
                      >
                        {trade.traderAlias[0]?.toUpperCase() || '?'}
                      </div>
                      <span className="text-sm font-semibold text-text-primary truncate">
                        {trade.traderAlias}
                      </span>
                      {trade.traderTier && <TierBadge tier={trade.traderTier} />}
                      <DirectionBadge direction={trade.direction} />
                      {trade.manual && (
                        <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                          Manual
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-text-secondary leading-snug truncate sm:whitespace-normal">
                      {trade.marketQuestion}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-text-muted">
                      <span>
                        Trader: <span className="font-mono text-text-secondary">${trade.traderAmount.toFixed(0)}</span> at{' '}
                        <span className="font-mono text-text-secondary">{(trade.traderPrice * 100).toFixed(0)}c</span>
                      </span>
                      <span>
                        Now: <span className="font-mono text-text-secondary">{(currentPrice * 100).toFixed(0)}c</span>
                      </span>
                      <span>{timeAgo(trade.timestamp)}</span>
                    </div>
                  </div>

                  {/* Right: sizing + action */}
                  {(() => {
                    const override = overrides[trade.signalId];
                    const mode = override?.mode ?? (trade.sizingMode === 'percentage' ? 'percent' : 'fixed');
                    const value = override?.value ?? trade.sizingValue;
                    const effAmt = getEffectiveAmount(trade);

                    return (
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {/* Sizing toggle + input */}
                        <div className="flex items-center gap-1">
                          <div className="flex rounded-md border border-ep-border overflow-hidden">
                            <button
                              onClick={() => setOverride(trade.signalId, {
                                mode: 'fixed',
                                value: mode === 'fixed' ? value : (trade.sizingMode !== 'percentage' ? trade.sizingValue : 5),
                              })}
                              className={`px-1.5 py-0.5 text-[10px] font-bold transition ${
                                mode === 'fixed'
                                  ? 'bg-accent/20 text-accent'
                                  : 'text-text-muted hover:text-text-secondary'
                              }`}
                            >
                              $
                            </button>
                            <button
                              onClick={() => setOverride(trade.signalId, {
                                mode: 'percent',
                                value: mode === 'percent' ? value : (trade.sizingMode === 'percentage' ? trade.sizingValue : 10),
                              })}
                              className={`px-1.5 py-0.5 text-[10px] font-bold transition ${
                                mode === 'percent'
                                  ? 'bg-accent/20 text-accent'
                                  : 'text-text-muted hover:text-text-secondary'
                              }`}
                            >
                              %
                            </button>
                          </div>
                          <input
                            type="number"
                            min={1}
                            value={value}
                            onChange={(e) => setOverride(trade.signalId, { mode, value: Math.max(Number(e.target.value) || 1, 1) })}
                            className="w-12 rounded-md border border-ep-border bg-transparent px-1.5 py-0.5 text-[11px] font-mono text-text-primary text-right focus:border-accent focus:outline-none"
                          />
                        </div>

                        {/* Trade button */}
                        <button
                          onClick={() => handleExecute(trade, false, effAmt)}
                          disabled={isExecuting || executingAll || hasInsufficientBalance}
                          className="btn-accent text-xs px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap disabled:opacity-50 w-full"
                        >
                          {isExecuting ? 'Placing...' : `Trade $${effAmt}`}
                        </button>
                        <button
                          onClick={() => handleDismiss(trade)}
                          disabled={isExecuting}
                          className="text-[10px] text-text-muted hover:text-text-secondary transition text-center"
                        >
                          Dismiss
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Mobile daily limit (shown below cards) */}
      <div className="flex sm:hidden items-center justify-center gap-2 text-xs text-text-muted">
        <div className="w-20 h-1.5 bg-ep-border rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all"
            style={{
              width: `${stats.dailyLimit > 0 ? (stats.dailyUsed / stats.dailyLimit) * 100 : 0}%`,
            }}
          />
        </div>
        <span className="font-mono">
          {stats.dailyUsed}/{stats.dailyLimit} auto-trades today
        </span>
      </div>
    </div>
  );
}
