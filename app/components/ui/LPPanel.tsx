'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WalletConnectButton } from './WalletConnectButton';
import { useToast } from './Toast';
import { useUserStore } from '@/app/lib/stores/user-store';
import { useUsdcBalance } from '@/app/lib/hooks/useUsdcBalance';
import { useLPOrder } from '@/app/lib/hooks/useLPOrder';

export interface LPMarket {
  condition_id: string;
  question: string;
  slug: string;
  yes_token: string;
  no_token: string;
  midpoint: number;
  daily_reward: number;
  max_spread: number;
  min_size: number;
  est_apy: number;
  fill_risk: number;
  mm_score: number;
  risk_tier: string;
  days_remaining: number;
}

interface LPPanelProps {
  market: LPMarket | null;
  isOpen: boolean;
  onClose: () => void;
}

export function LPPanel({ market, isOpen, onClose }: LPPanelProps) {
  const { isConnected, hasCredentials } = useUserStore();
  const { toast } = useToast();
  const { placeLPOrders, isReady } = useLPOrder();
  const { balance, refetch: refetchBalance } = useUsdcBalance();

  const [amount, setAmount] = useState(100);
  const [spreadCents, setSpreadCents] = useState(2); // spread in cents from midpoint
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Reset state when market changes
  useEffect(() => {
    if (isOpen && market) {
      setAmount(Math.max(market.min_size * 2, 50));
      setSpreadCents(Math.round((market.max_spread / 2) * 100));
      setStatus('idle');
      setErrorMsg('');
      refetchBalance();
    }
  }, [isOpen, market?.condition_id]);

  // Computed prices
  const prices = useMemo(() => {
    if (!market) return { yes: 0, no: 0 };
    const spreadDecimal = spreadCents / 100;
    const yesPrice = Math.max(0.01, Math.min(0.99, market.midpoint - spreadDecimal / 2));
    const noPrice = Math.max(0.01, Math.min(0.99, 1 - (market.midpoint + spreadDecimal / 2)));
    return {
      yes: Math.round(yesPrice * 100) / 100,
      no: Math.round(noPrice * 100) / 100,
    };
  }, [market?.midpoint, spreadCents]);

  const halfAmount = amount / 2;
  const usdcBalance = balance ?? 0;
  const insufficientBalance = amount > usdcBalance;
  const belowMinSize = market ? amount / 2 < market.min_size : false;
  const canSubmit = isReady && !insufficientBalance && !belowMinSize && amount > 0 && status === 'idle';

  const handleSubmit = async () => {
    if (!market || !canSubmit) return;

    setStatus('submitting');
    setErrorMsg('');

    try {
      const result = await placeLPOrders({
        yesTokenId: market.yes_token,
        noTokenId: market.no_token,
        amount,
        yesPrice: prices.yes,
        noPrice: prices.no,
      });

      const yesFailed = result.yesResult.status === 'rejected';
      const noFailed = result.noResult.status === 'rejected';

      if (yesFailed && noFailed) {
        setStatus('error');
        const yesErr = (result.yesResult as PromiseRejectedResult).reason?.message || 'Unknown error';
        setErrorMsg(`Both orders failed: ${yesErr}`);
        toast('error', 'LP Orders Failed', yesErr);
      } else if (yesFailed || noFailed) {
        setStatus('error');
        const side = yesFailed ? 'YES' : 'NO';
        const err = yesFailed
          ? (result.yesResult as PromiseRejectedResult).reason?.message
          : (result.noResult as PromiseRejectedResult).reason?.message;
        setErrorMsg(`${side} order failed: ${err}`);
        toast('error', `${side} Order Failed`, err || 'Partial fill');
      } else {
        setStatus('success');
        toast('success', 'LP Orders Placed', `$${amount} deployed across YES & NO`);
        refetchBalance();
        setTimeout(onClose, 2000);
      }
    } catch (err: any) {
      setStatus('error');
      if (err.code === 4001 || err.message?.includes('rejected')) {
        setErrorMsg('Transaction rejected in wallet');
      } else {
        setErrorMsg(err.message || 'Something went wrong');
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && market && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
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
                  <div className="w-3 h-3 rounded-full bg-accent" />
                  <h2 className="font-display text-lg font-bold text-text-primary">
                    Provide Liquidity
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-ep-card text-text-muted hover:text-text-primary transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-text-secondary mt-1 line-clamp-2">
                {market.question}
              </p>
            </div>

            <div className="p-4 space-y-5">
              {/* Reward Info */}
              <div className="bg-ep-card rounded-xl p-4 border border-ep-border">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-text-muted uppercase tracking-wider">Daily Reward</span>
                    <p className="font-mono font-bold text-accent text-sm">${market.daily_reward.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase tracking-wider">Est. APY</span>
                    <p className="font-mono font-bold text-accent text-sm">{market.est_apy.toFixed(1)}%</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase tracking-wider">Max Spread</span>
                    <p className="font-mono text-sm text-text-primary">{(market.max_spread * 100).toFixed(1)}&cent;</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase tracking-wider">Min Size</span>
                    <p className="font-mono text-sm text-text-primary">${market.min_size}</p>
                  </div>
                </div>
              </div>

              {/* Wallet gate */}
              {!isConnected || !hasCredentials ? (
                <div className="space-y-3">
                  <p className="text-sm text-text-muted text-center">
                    Connect your wallet to provide liquidity
                  </p>
                  <WalletConnectButton variant="header" />
                </div>
              ) : (
                <>
                  {/* Amount Input */}
                  <div>
                    <label className="text-xs text-text-muted uppercase tracking-wider mb-1.5 block">
                      Amount (USDC)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                        className="w-full bg-ep-card border border-ep-border rounded-lg pl-7 pr-4 py-3 text-text-primary font-mono text-sm
                                   focus:outline-none focus:border-accent/50"
                        min={0}
                        step={10}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-text-muted">
                        Balance: ${usdcBalance.toFixed(2)}
                      </span>
                      {insufficientBalance && (
                        <span className="text-[10px] text-loss">Insufficient balance</span>
                      )}
                      {belowMinSize && !insufficientBalance && (
                        <span className="text-[10px] text-loss">
                          Min ${market.min_size} per side
                        </span>
                      )}
                    </div>

                    {/* Quick amount pills */}
                    <div className="flex gap-1.5 mt-2">
                      {[50, 100, 250, 500].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setAmount(preset)}
                          className={`flex-1 text-xs py-1.5 rounded-lg font-mono transition-colors
                            ${amount === preset
                              ? 'bg-accent/20 text-accent border border-accent/30'
                              : 'bg-ep-card border border-ep-border text-text-secondary hover:text-text-primary'
                            }`}
                        >
                          ${preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Spread Input */}
                  <div>
                    <label className="text-xs text-text-muted uppercase tracking-wider mb-1.5 block">
                      Spread from Midpoint
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={spreadCents}
                        onChange={(e) => setSpreadCents(Math.max(1, Math.min(50, Number(e.target.value))))}
                        className="w-full bg-ep-card border border-ep-border rounded-lg px-4 py-3 text-text-primary font-mono text-sm text-center
                                   focus:outline-none focus:border-accent/50"
                        min={1}
                        max={50}
                        step={1}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">cents</span>
                    </div>
                    {spreadCents / 100 > market.max_spread && (
                      <p className="text-[10px] text-loss mt-1">
                        Spread exceeds max ({(market.max_spread * 100).toFixed(0)}&cent;) — won't earn rewards
                      </p>
                    )}
                  </div>

                  {/* Order Preview */}
                  <div className="bg-ep-card rounded-xl p-4 border border-ep-border">
                    <span className="text-[10px] text-text-muted uppercase tracking-wider mb-2 block">
                      Order Preview
                    </span>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-profit" />
                          <span className="text-sm text-text-secondary">YES @ ${prices.yes.toFixed(2)}</span>
                        </div>
                        <span className="font-mono text-sm text-text-primary">${halfAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-loss" />
                          <span className="text-sm text-text-secondary">NO @ ${prices.no.toFixed(2)}</span>
                        </div>
                        <span className="font-mono text-sm text-text-primary">${halfAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all
                      ${canSubmit
                        ? 'bg-accent text-white hover:bg-accent/90 active:scale-[0.98]'
                        : 'bg-ep-card text-text-muted cursor-not-allowed opacity-50'
                      }`}
                  >
                    {status === 'submitting' ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Placing Orders...
                      </span>
                    ) : status === 'success' ? (
                      'Orders Placed!'
                    ) : (
                      'Place LP Orders'
                    )}
                  </button>

                  {/* Error message */}
                  {status === 'error' && errorMsg && (
                    <div className="bg-loss/10 border border-loss/20 rounded-lg p-3">
                      <p className="text-xs text-loss">{errorMsg}</p>
                    </div>
                  )}

                  {/* Risk info */}
                  <div className="flex items-center justify-center gap-4 text-[10px] text-text-muted">
                    <span>Fill Risk: {market.fill_risk.toFixed(0)}%</span>
                    <span className="text-ep-border">|</span>
                    <span>MM Score: {market.mm_score.toFixed(0)}</span>
                    <span className="text-ep-border">|</span>
                    <span>{market.days_remaining}d left</span>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
