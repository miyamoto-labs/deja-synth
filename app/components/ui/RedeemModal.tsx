'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRedeem } from '@/app/lib/hooks/useRedeem';
import { useToast } from './Toast';

export interface RedeemPosition {
  id: string;
  question: string;
  outcome: string;
  size: number;
  avgPrice: number;
  curPrice: number;
  currentValue: number;
  initialValue: number;
  pnl: number;
  pnlPercent: number;
  conditionId: string;
  negRisk: boolean;
  assetId?: string;
  outcomeIndex?: number;
}

interface RedeemModalProps {
  position: RedeemPosition | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function RedeemModal({ position, onClose, onSuccess }: RedeemModalProps) {
  const { redeem, reset, status, txHash, error, isReady } = useRedeem();
  const { toast } = useToast();

  // Reset state when position changes
  useEffect(() => {
    if (position) reset();
  }, [position, reset]);

  if (!position) return null;

  // For resolved markets, winning shares are worth $1.00 each, losing worth $0
  const isWinning = position.curPrice > 0.5;
  const redemptionValue = isWinning ? position.size * 1.0 : 0;
  const costBasis = position.size * position.avgPrice;
  const redeemPnl = redemptionValue - costBasis;
  const isProfit = redeemPnl >= 0;

  const handleRedeem = async () => {
    if (!position.conditionId) {
      toast('error', 'Missing Data', 'Cannot redeem — condition ID not available for this market.');
      return;
    }

    const success = await redeem(position.conditionId, position.negRisk, position.assetId, position.outcomeIndex);

    if (success) {
      toast(
        'success',
        'Redeemed!',
        isWinning
          ? `Redeemed ${position.size.toFixed(1)} ${position.outcome} shares for $${redemptionValue.toFixed(2)} USDC`
          : `Redeemed position — shares were worth $0 (losing outcome)`
      );
      onSuccess();
      onClose();
    } else {
      // Error is shown in the modal UI
    }
  };

  const isLoading = status === 'redeeming' || status === 'polling';

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
            <div className="flex items-center gap-2">
              <span className="text-xl">{isWinning ? '🏆' : '📉'}</span>
              <h3 className="font-display text-lg font-bold text-text-primary">
                {isWinning ? 'Redeem Winnings' : 'Redeem Position'}
              </h3>
            </div>
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

          {/* Status banner */}
          <div className={`mb-4 p-3 rounded-xl border ${
            isWinning
              ? 'bg-emerald-500/[0.08] border-emerald-500/20'
              : 'bg-red-500/[0.08] border-red-500/20'
          }`}>
            <div className="flex items-center gap-2 text-sm font-bold">
              <span className={isWinning ? 'text-emerald-400' : 'text-red-400'}>
                {isWinning ? '✓ Market resolved in your favor' : '✗ Market resolved against you'}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              {isWinning
                ? 'Your shares are worth $1.00 each. Redeem to convert to USDC.'
                : 'Your shares are worth $0. You can still redeem to clear the position.'}
            </p>
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
              <span className="text-text-muted">Shares Held</span>
              <span className="font-mono text-text-primary">{position.size.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">Entry Price</span>
              <span className="font-mono text-text-secondary">{(position.avgPrice * 100).toFixed(1)}¢</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">Cost Basis</span>
              <span className="font-mono text-text-secondary">${costBasis.toFixed(2)}</span>
            </div>
          </div>

          {/* Redemption summary */}
          <div className="space-y-2 mb-5 p-3 rounded-xl bg-ep-surface/50 border border-ep-border/50">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">Redemption Value</span>
              <span className="font-mono font-bold text-text-primary">
                ${redemptionValue.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">P&L</span>
              <span className={`font-mono font-bold ${isProfit ? 'text-profit' : 'text-loss'}`}>
                {isProfit ? '+' : ''}${redeemPnl.toFixed(2)}
              </span>
            </div>

            {isWinning && (
              <div className="flex items-center justify-between text-xs border-t border-ep-border/50 pt-2 mt-1">
                <span className="text-text-muted">Return</span>
                <span className={`font-mono font-bold ${isProfit ? 'text-profit' : 'text-loss'}`}>
                  {isProfit ? '+' : ''}{((redeemPnl / costBasis) * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>

          {/* Error display */}
          {error && (
            <div className="mb-4 p-2.5 rounded-lg bg-red-500/[0.08] border border-red-500/20 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Status messages */}
          {status === 'polling' && (
            <div className="mb-4 p-2.5 rounded-lg bg-accent/[0.08] border border-accent/20 text-xs text-accent">
              Transaction submitted — waiting for on-chain confirmation...
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-text-secondary bg-ep-surface border border-ep-border hover:border-ep-border/80 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleRedeem}
              disabled={isLoading || !isReady || !position.conditionId}
              className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition flex items-center justify-center gap-2 disabled:opacity-50 ${
                isWinning
                  ? 'bg-profit hover:bg-profit/90'
                  : 'bg-text-muted hover:bg-text-muted/90'
              }`}
            >
              {isLoading ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {status === 'polling' ? 'Confirming...' : 'Redeeming...'}
                </>
              ) : (
                <>Redeem {isWinning ? `$${redemptionValue.toFixed(2)}` : 'Position'}</>
              )}
            </button>
          </div>

          {/* Tx hash */}
          {txHash && (
            <div className="mt-3 text-center">
              <a
                href={`https://polygonscan.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-accent hover:underline"
              >
                View on Polygonscan →
              </a>
            </div>
          )}

          {!isReady && (
            <p className="text-[10px] text-yellow-400 text-center mt-3">
              Trading session not ready — log in to enable redemption
            </p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
