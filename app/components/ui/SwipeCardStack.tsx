'use client';

import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SwipeCard, type FeedCard } from './SwipeCard';
import { useUserStore } from '@/app/lib/stores/user-store';
import { useToast } from './Toast';
import { useClobClient } from '@/app/lib/hooks/useClobClient';
import { useUsdcBalance } from '@/app/lib/hooks/useUsdcBalance';

/* ── Types ─────────────────────────────────────── */
export interface QueuedBet {
  tokenId: string;
  price: number;
  amount: number;
  direction: string;
  sourceId: string;
  question: string;
  marketId: string;
}

interface SwipeCardStackProps {
  cards: FeedCard[];
  onNeedMore: () => void;
  onReshuffle?: (cards: FeedCard[]) => void;
  defaultBetAmount: number;
}

interface SessionStats {
  swiped: number;
  yesCount: number;
  noCount: number;
  skipped: number;
}

/* ── Component ─────────────────────────────────── */
export function SwipeCardStack({ cards, onNeedMore, onReshuffle, defaultBetAmount }: SwipeCardStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [betAmount, setBetAmount] = useState(defaultBetAmount);
  const [queue, setQueue] = useState<QueuedBet[]>([]);
  const [showQueue, setShowQueue] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [stats, setStats] = useState<SessionStats>({ swiped: 0, yesCount: 0, noCount: 0, skipped: 0 });

  // Reshuffling state
  const [yesSwipedIds, setYesSwipedIds] = useState<Set<string>>(new Set());
  const [reshuffling, setReshuffling] = useState(false);
  const [reshuffleCount, setReshuffleCount] = useState(0);

  const { walletAddress, isConnected } = useUserStore();
  const { toast } = useToast();
  const { createOrder, isReady: clobReady, safeAddress } = useClobClient();
  const { balance: usdcBalance, formatted: balanceFormatted, refetch: refetchBalance } = useUsdcBalance();

  // Update bet amount when default changes
  useEffect(() => {
    setBetAmount(defaultBetAmount);
  }, [defaultBetAmount]);

  // Prefetch when running low
  useEffect(() => {
    if (cards.length - currentIndex <= 5) {
      onNeedMore();
    }
  }, [currentIndex, cards.length, onNeedMore]);

  const advance = useCallback(() => {
    setCurrentIndex((i) => i + 1);
  }, []);

  const handleSwipe = useCallback(
    (direction: 'left' | 'right' | 'up') => {
      const card = cards[currentIndex];
      if (!card) return;

      if (direction === 'up') {
        setStats((s) => ({ ...s, swiped: s.swiped + 1, skipped: s.skipped + 1 }));
        advance();
        return;
      }

      const side = direction === 'right' ? 'YES' : 'NO';

      if (!isConnected || !walletAddress) {
        toast('info', 'Log In', 'Log in to place bets!');
        setStats((s) => ({ ...s, swiped: s.swiped + 1, skipped: s.skipped + 1 }));
        advance();
        return;
      }

      // Add to queue
      const tokenId = side === 'YES' ? card.yes_token : card.no_token;
      const price = side === 'YES' ? card.yes_price : card.no_price;

      const bet: QueuedBet = {
        tokenId,
        price,
        amount: betAmount,
        direction: side,
        sourceId: card.pick_id || card.signal_id || card.market_id,
        question: card.question.length > 50 ? card.question.slice(0, 50) + '...' : card.question,
        marketId: card.market_id,
      };

      setQueue((q) => [...q, bet]);
      if (direction === 'right') {
        setYesSwipedIds((prev) => new Set(prev).add(card.id));
      }
      setStats((s) => ({
        ...s,
        swiped: s.swiped + 1,
        yesCount: s.yesCount + (side === 'YES' ? 1 : 0),
        noCount: s.noCount + (side === 'NO' ? 1 : 0),
      }));

      toast('success',
        `${side} Queued`,
        `$${betAmount} ${side} on ${card.question.slice(0, 40)}...`
      );

      advance();
    },
    [cards, currentIndex, betAmount, isConnected, walletAddress, advance, toast]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        handleSwipe('right');
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handleSwipe('left');
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
        e.preventDefault();
        handleSwipe('up');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSwipe]);

  const removeBet = useCallback((index: number) => {
    setQueue((q) => q.filter((_, i) => i !== index));
  }, []);

  const executeQueue = useCallback(async () => {
    if (queue.length === 0) return;

    // Pre-trade balance check — block if balance unknown OR insufficient
    const totalCost = queue.reduce((s, b) => s + b.amount, 0);
    if (usdcBalance === null) {
      // Balance hasn't loaded yet — kick off a fetch and tell user to retry
      refetchBalance();
      toast('error',
        'Balance Unknown',
        'Could not verify your USDC balance. Make sure your wallet is connected and try again.'
      );
      return;
    }
    if (usdcBalance < totalCost) {
      const shortfall = (totalCost - usdcBalance).toFixed(2);
      toast('error',
        'Insufficient Balance',
        `Need $${totalCost} but have ${balanceFormatted || '$0.00'}. Deposit $${shortfall} more USDC to your Safe wallet.`
      );
      return;
    }

    // Privy signing path (no MetaMask popups)
    if (createOrder && clobReady) {
      setExecuting(true);
      let succeeded = 0;
      let failed = 0;
      let totalAmount = 0;
      const failErrors: string[] = [];

      toast('info', 'Placing Bets', `Signing ${queue.length} trade(s)...`);

      for (const bet of queue) {
        try {
          // Ensure the order meets the CLOB's $1 minimum after rounding.
          // The CLOB computes cost = size * price, so we round size UP
          // to 2 decimal places to avoid sub-$1 dust from floating-point math.
          const effectiveAmount = Math.max(bet.amount, 1.01);
          const rawSize = effectiveAmount / bet.price;
          const size = Math.ceil(rawSize * 100) / 100; // Round up to 2 decimals
          console.log(`[PolyTinder] Placing order:`, {
            tokenID: bet.tokenId,
            side: 'BUY',
            size: size.toFixed(4),
            price: bet.price,
            amount: bet.amount,
            effectiveAmount,
            direction: bet.direction,
          });
          const result = await createOrder({
            tokenID: bet.tokenId,
            side: 'BUY',
            size,
            price: bet.price,
          });
          console.log(`[PolyTinder] Order result:`, JSON.stringify(result));

          // Check if CLOB returned an error
          if (result?.errorMsg || result?.error) {
            console.error(`[PolyTinder] CLOB error:`, result.errorMsg || result.error);
            toast('error', 'Order Rejected', result.errorMsg || result.error || 'Unknown CLOB error');
            failed++;
          } else {
            succeeded++;
            totalAmount += bet.amount;
          }
        } catch (err: any) {
          console.error(`[PolyTinder] Bet exception:`, err?.message, err?.response?.data || err);
          failed++;
          failErrors.push(err?.message || 'Unknown error');
        }
      }

      if (succeeded > 0) {
        toast('success',
          `${succeeded}/${queue.length} Bets Placed!`,
          `Total: $${totalAmount} across ${succeeded} markets`
        );

        // Log trades to Supabase
        try {
          const tradingAddress = safeAddress || walletAddress;
          if (tradingAddress) {
            await fetch('/api/polytinder/log', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                walletAddress: tradingAddress,
                bets: queue.slice(0, succeeded).map((b) => ({
                  tokenId: b.tokenId,
                  direction: b.direction,
                  amount: b.amount,
                  price: b.price,
                  source: 'polytinder',
                  sourceId: b.sourceId,
                })),
              }),
            });
          }
        } catch {
          // Non-critical — continue even if logging fails
        }
      }

      if (failed > 0 && succeeded === 0) {
        const reason = failErrors[0] || 'Check your balance and try again.';
        toast('error', 'Bets Failed', reason);
      } else if (failed > 0) {
        toast('info', `${failed} Failed`, failErrors[0] || 'Some bets were rejected by the exchange.');
      }

      setQueue(succeeded === queue.length ? [] : queue.slice(succeeded));
      setExecuting(false);
      refetchBalance(); // Update balance after trades
      return;
    }

    // Fallback: server-side batch execution (for users with stored keys)
    if (!walletAddress) {
      toast('info', 'Log In', 'Log in to place bets.');
      return;
    }

    setExecuting(true);
    try {
      const res = await fetch('/api/polytinder/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, bets: queue }),
      });

      const data = await res.json();

      if (data.success) {
        toast('success',
          `${data.executed}/${data.total} Bets Placed!`,
          `Total: $${data.totalAmount} across ${data.executed} markets`
        );
        setQueue([]);
      } else if (data.executed > 0) {
        toast('info',
          `${data.executed}/${data.total} Succeeded`,
          `${data.failed} bets failed. Check your balance.`
        );
        const failedIndices = new Set(
          data.results.filter((r: any) => !r.success).map((r: any) => r.index)
        );
        setQueue((q) => q.filter((_, i) => failedIndices.has(i)));
      } else {
        toast('error', 'Bets Failed', data.error || 'All bets failed. Check balance and credentials.');
      }
    } catch (err: any) {
      toast('error', 'Execution Error', err.message || 'Something went wrong');
    }
    setExecuting(false);
  }, [queue, createOrder, clobReady, safeAddress, walletAddress, toast, usdcBalance, balanceFormatted, refetchBalance]);

  const queueTotal = queue.reduce((s, b) => s + b.amount, 0);
  const visibleCards = cards.slice(currentIndex, currentIndex + 3);
  const isExhausted = currentIndex >= cards.length;

  // Auto-reshuffle when deck is exhausted (Tinder-style)
  useEffect(() => {
    if (!isExhausted || cards.length === 0 || reshuffling || !onReshuffle) return;

    setReshuffling(true);

    const timer = setTimeout(() => {
      // Filter out YES-swiped cards, shuffle remaining
      const reshuffledCards = cards
        .filter((c) => !yesSwipedIds.has(c.id))
        .sort(() => Math.random() - 0.5);

      if (reshuffledCards.length === 0) {
        // All cards were YES-swiped — nothing to reshuffle
        setReshuffling(false);
        return;
      }

      onReshuffle(reshuffledCards);
      setCurrentIndex(0);
      setReshuffleCount((c) => c + 1);
      setReshuffling(false);

      // Fetch fresh cards to append
      onNeedMore();
    }, 1200);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExhausted, cards.length, reshuffling]);

  return (
    <div className="flex flex-col items-center gap-2 sm:gap-4 w-full flex-1 min-h-0">
      {/* ── Card Stack ── */}
      <div
        className="relative w-full max-w-[92vw] sm:max-w-[420px] mx-auto flex-1 min-h-0 sm:h-[500px] sm:flex-none"
      >
        {(isExhausted || reshuffling) ? (
          <div className="absolute inset-0 flex items-center justify-center">
            {reshuffling ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="ep-card rounded-2xl p-8 text-center max-w-[340px]"
              >
                <motion.div
                  className="text-5xl mb-4"
                  animate={{ rotate: [0, 180, 360] }}
                  transition={{ duration: 1, ease: 'easeInOut', repeat: Infinity }}
                >
                  🔄
                </motion.div>
                <h3 className="font-display text-xl font-bold text-text-primary mb-2">
                  Reshuffling deck...
                </h3>
                <p className="text-sm text-text-muted">
                  {reshuffleCount > 0 ? `Round ${reshuffleCount + 1}` : 'Mixing it up'}
                </p>
              </motion.div>
            ) : (
              <div className="ep-card rounded-2xl p-8 text-center max-w-[340px]">
                <div className="text-5xl mb-4">🎉</div>
                <h3 className="font-display text-xl font-bold text-text-primary mb-2">
                  All cards swiped!
                </h3>
                <p className="text-sm text-text-muted mb-4">
                  {stats.swiped} markets reviewed · {stats.yesCount} YES · {stats.noCount} NO · {stats.skipped} skipped
                </p>
                {queue.length > 0 && (
                  <p className="text-xs text-accent mb-4">
                    Don&apos;t forget to confirm your {queue.length} queued bets below!
                  </p>
                )}
                <button
                  onClick={() => {
                    setCurrentIndex(0);
                    setYesSwipedIds(new Set());
                    setStats({ swiped: 0, yesCount: 0, noCount: 0, skipped: 0 });
                    onNeedMore();
                  }}
                  className="btn-accent px-6 py-2 rounded-xl text-sm font-semibold"
                >
                  Start Fresh
                </button>
              </div>
            )}
          </div>
        ) : (
          <AnimatePresence>
            {visibleCards.map((card, i) => (
              <SwipeCard
                key={card.id}
                card={card}
                onSwipe={handleSwipe}
                isTop={i === 0}
                stackIndex={i}
                betAmount={betAmount}
                onAmountChange={setBetAmount}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* ── Action Buttons (Tinder-style) ── */}
      {!isExhausted && !reshuffling && (
        <div className="flex items-center justify-center gap-5 sm:gap-8 shrink-0 py-1 sm:py-0">
          {/* NO */}
          <button
            onClick={() => handleSwipe('left')}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-loss/40
              bg-loss/[0.06] hover:bg-loss/15 hover:border-loss/70 hover:scale-110
              active:scale-95 transition-all duration-200
              flex items-center justify-center
              shadow-[0_0_20px_rgba(255,64,96,0.08)]
              hover:shadow-[0_0_30px_rgba(255,64,96,0.25)]"
            aria-label="Swipe NO"
          >
            <svg className="w-6 h-6 sm:w-7 sm:h-7 text-loss" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* SKIP */}
          <button
            onClick={() => handleSwipe('up')}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-ep-border-bright/50
              bg-ep-surface/30 hover:bg-ep-surface/60 hover:border-text-muted/50 hover:scale-110
              active:scale-95 transition-all duration-200
              flex items-center justify-center"
            aria-label="Skip"
          >
            <span className="text-[10px] sm:text-xs font-bold text-text-muted tracking-wide">SKIP</span>
          </button>

          {/* YES */}
          <button
            onClick={() => handleSwipe('right')}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-profit/40
              bg-profit/[0.06] hover:bg-profit/15 hover:border-profit/70 hover:scale-110
              active:scale-95 transition-all duration-200
              flex items-center justify-center
              shadow-[0_0_20px_rgba(0,240,160,0.08)]
              hover:shadow-[0_0_30px_rgba(0,240,160,0.25)]"
            aria-label="Swipe YES"
          >
            <svg className="w-6 h-6 sm:w-7 sm:h-7 text-profit" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Deck Progress ── */}
      {!isExhausted && cards.length > 0 && (
        <div className="w-full max-w-[92vw] sm:max-w-[400px] mx-auto shrink-0">
          <div className="h-1 bg-ep-border/50 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-accent/50 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(((currentIndex + 1) / cards.length) * 100, 100)}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-text-muted font-mono">
            <span>{currentIndex + 1}/{cards.length}</span>
            <div className="flex items-center gap-2">
              {reshuffleCount > 0 && <span className="text-accent">Round {reshuffleCount + 1}</span>}
              {stats.swiped > 0 && (
                <span>
                  <span className="text-profit">{stats.yesCount}Y</span>
                  {' · '}
                  <span className="text-loss">{stats.noCount}N</span>
                  {' · '}
                  {stats.skipped}S
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Keyboard Shortcuts (desktop only) ── */}
      {!isExhausted && (
        <div className="hidden sm:flex items-center gap-4 text-[11px] text-text-muted">
          <span><kbd className="px-1.5 py-0.5 rounded bg-ep-surface border border-ep-border text-text-secondary font-mono">←</kbd> NO</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-ep-surface border border-ep-border text-text-secondary font-mono">↑</kbd> Skip</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-ep-surface border border-ep-border text-text-secondary font-mono">→</kbd> YES</span>
        </div>
      )}

      {/* ── Queue Bar ── */}
      {queue.length > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-[92vw] sm:max-w-[420px] mx-auto shrink-0"
        >
          <div className="ep-card rounded-xl border border-accent/20 overflow-hidden">
            {/* Queue summary + balance + confirm */}
            <div className="flex items-center justify-between p-3">
              <button
                onClick={() => setShowQueue(!showQueue)}
                className="flex items-center gap-2 text-sm font-semibold text-text-primary"
              >
                <span className="w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">
                  {queue.length}
                </span>
                <span>
                  {queue.length} bet{queue.length > 1 ? 's' : ''} · ${queueTotal}
                </span>
                <svg
                  className={`w-3.5 h-3.5 text-text-muted transition ${showQueue ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <div className="flex items-center gap-2">
                {/* Balance indicator */}
                <span className={`text-[10px] font-mono ${
                  usdcBalance === null
                    ? 'text-text-muted'
                    : usdcBalance >= queueTotal
                      ? 'text-profit'
                      : 'text-loss'
                }`}>
                  Bal: {balanceFormatted ?? '—'}
                </span>
                <button
                  onClick={executeQueue}
                  disabled={executing}
                  className="btn-accent px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  {executing ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Placing...
                    </>
                  ) : (
                    <>Confirm All</>
                  )}
                </button>
              </div>
            </div>

            {/* Expanded queue list */}
            <AnimatePresence>
              {showQueue && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-ep-border px-3 py-2 space-y-1.5 max-h-48 overflow-y-auto">
                    {queue.map((bet, i) => (
                      <div
                        key={`${bet.marketId}-${i}`}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span className={`font-mono font-bold ${bet.direction === 'YES' ? 'text-profit' : 'text-loss'}`}>
                          {bet.direction}
                        </span>
                        <span className="text-text-secondary flex-1 truncate">
                          {bet.question}
                        </span>
                        <span className="font-mono text-text-primary shrink-0">${bet.amount}</span>
                        <button
                          onClick={() => removeBet(i)}
                          className="text-text-muted hover:text-loss transition shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </div>
  );
}
