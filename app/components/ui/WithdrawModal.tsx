'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWithdraw, type WithdrawStatus, type TokenChoice } from '@/app/lib/hooks/useWithdraw';

interface WithdrawModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const STATUS_MESSAGES: Record<WithdrawStatus, string> = {
  idle: '',
  confirming: 'Confirm in your wallet...',
  sending: 'Submitting withdrawal...',
  polling: 'Waiting for confirmation...',
  success: 'Withdrawal complete!',
  error: 'Withdrawal failed',
};

export function WithdrawModal({ open, onClose, onSuccess }: WithdrawModalProps) {
  const { withdraw, reset, status, txHash, error, onchainUsdc, onchainUsdce, safeAddress } = useWithdraw();
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<TokenChoice>('usdc');
  const hasInitialized = useRef(false);

  // Reset form only when modal opens — NOT on every balance poll
  useEffect(() => {
    if (open) {
      reset();
      setToAddress('');
      setAmount('');
      hasInitialized.current = false;
    }
  }, [open, reset]);

  // Set default token once balances load (only first time modal opens)
  useEffect(() => {
    if (!open || hasInitialized.current) return;
    if (onchainUsdc === null && onchainUsdce === null) return; // still loading

    // Default to whichever token actually has on-chain balance
    if ((onchainUsdc ?? 0) > 0) setSelectedToken('usdc');
    else if ((onchainUsdce ?? 0) > 0) setSelectedToken('usdc.e');
    else setSelectedToken('usdc'); // fallback

    hasInitialized.current = true;
  }, [open, onchainUsdc, onchainUsdce]);

  // Notify parent on success
  useEffect(() => {
    if (status === 'success' && onSuccess) {
      onSuccess();
    }
  }, [status, onSuccess]);

  const selectedBalance = selectedToken === 'usdc.e' ? onchainUsdce : onchainUsdc;
  const selectedLabel = selectedToken === 'usdc.e' ? 'USDC.e' : 'USDC';

  const handleMax = () => {
    if (selectedBalance !== null && selectedBalance > 0) {
      setAmount(selectedBalance.toFixed(2));
    }
  };

  const handleWithdraw = async () => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return;
    await withdraw(toAddress, amountNum, selectedToken);
  };

  const isProcessing = status === 'sending' || status === 'polling' || status === 'confirming';
  const amountNum = parseFloat(amount) || 0;
  const isValid = toAddress.startsWith('0x') && toAddress.length === 42 && amountNum > 0 && (selectedBalance === null || amountNum <= selectedBalance);

  const hasUsdce = (onchainUsdce ?? 0) > 0;
  const hasUsdc = (onchainUsdc ?? 0) > 0;
  const hasBoth = hasUsdce && hasUsdc;
  const hasNothing = !hasUsdce && !hasUsdc && onchainUsdc !== null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-[15vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={!isProcessing ? onClose : undefined}
          />

          {/* Modal */}
          <motion.div
            className="relative z-10 w-full max-w-md ep-card rounded-2xl border border-ep-border/60 overflow-hidden"
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-ep-border/50">
              <h3 className="font-display text-lg font-bold text-text-primary">
                Withdraw
              </h3>
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="text-text-muted hover:text-text-primary transition disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Empty state — no on-chain tokens to withdraw */}
              {hasNothing && status === 'idle' && (
                <div className="text-center py-3">
                  <p className="text-sm text-text-secondary">No tokens available to withdraw</p>
                  <p className="text-[11px] text-text-muted mt-1">
                    Your USDC.e is allocated for trading on Polymarket.
                  </p>
                </div>
              )}

              {/* Token selector — only when both tokens have on-chain balance */}
              {hasBoth && (
                <div>
                  <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                    Token
                  </label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => { setSelectedToken('usdc'); setAmount(''); }}
                      disabled={isProcessing || status === 'success'}
                      className={`px-3 py-2.5 rounded-lg text-xs font-bold transition border ${
                        selectedToken === 'usdc'
                          ? 'bg-accent/15 text-accent border-accent/40'
                          : 'bg-ep-surface/50 text-text-secondary border-ep-border/50 hover:border-accent/30'
                      } disabled:opacity-50`}
                    >
                      <div>USDC</div>
                      <div className="font-mono mt-0.5 text-[11px] opacity-70">
                        ${(onchainUsdc ?? 0).toFixed(2)}
                      </div>
                    </button>
                    <button
                      onClick={() => { setSelectedToken('usdc.e'); setAmount(''); }}
                      disabled={isProcessing || status === 'success'}
                      className={`px-3 py-2.5 rounded-lg text-xs font-bold transition border ${
                        selectedToken === 'usdc.e'
                          ? 'bg-accent/15 text-accent border-accent/40'
                          : 'bg-ep-surface/50 text-text-secondary border-ep-border/50 hover:border-accent/30'
                      } disabled:opacity-50`}
                    >
                      <div>USDC.e</div>
                      <div className="font-mono mt-0.5 text-[11px] opacity-70">
                        ${(onchainUsdce ?? 0).toFixed(2)}
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Main form — only show when there are tokens to withdraw */}
              {!hasNothing && (
                <>
                  {/* Balance info */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">Available {selectedLabel}</span>
                    <span className="font-mono font-bold text-accent">
                      {selectedBalance !== null ? `$${selectedBalance.toFixed(2)}` : '—'}
                    </span>
                  </div>

                  {/* From (Safe) */}
                  <div>
                    <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                      From (Your Trading Wallet)
                    </label>
                    <div className="mt-1 px-3 py-2 rounded-lg bg-ep-surface/50 border border-ep-border/50 text-xs font-mono text-text-secondary truncate">
                      {safeAddress || '—'}
                    </div>
                  </div>

                  {/* To Address */}
                  <div>
                    <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                      To (Destination Address)
                    </label>
                    <input
                      type="text"
                      value={toAddress}
                      onChange={(e) => setToAddress(e.target.value.trim())}
                      placeholder="0x..."
                      disabled={isProcessing || status === 'success'}
                      className="mt-1 w-full px-3 py-2.5 rounded-lg bg-ep-surface/50 border border-ep-border/50
                        text-sm font-mono text-text-primary placeholder:text-text-muted/40
                        focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20
                        disabled:opacity-50 transition"
                    />
                    <p className="text-[10px] text-text-muted mt-1">
                      Polygon network only. Send to any wallet or exchange that supports {selectedLabel} on Polygon.
                    </p>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                      Amount ({selectedLabel})
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">$</span>
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0.00"
                          min={0}
                          step={0.01}
                          disabled={isProcessing || status === 'success'}
                          className="w-full pl-7 pr-3 py-2.5 rounded-lg bg-ep-surface/50 border border-ep-border/50
                            text-sm font-mono text-text-primary placeholder:text-text-muted/40
                            focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20
                            disabled:opacity-50 transition
                            [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                      <button
                        onClick={handleMax}
                        disabled={isProcessing || status === 'success' || selectedBalance === null || selectedBalance <= 0}
                        className="px-3 py-2.5 rounded-lg text-xs font-bold bg-accent/10 text-accent
                          hover:bg-accent/20 transition disabled:opacity-50 shrink-0"
                      >
                        MAX
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Status / Error */}
              {status !== 'idle' && (
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
                    status === 'error'
                      ? 'bg-loss/10 text-loss border border-loss/20'
                      : status === 'success'
                        ? 'bg-profit/10 text-profit border border-profit/20'
                        : 'bg-accent/10 text-accent border border-accent/20'
                  }`}
                >
                  {isProcessing && (
                    <svg className="w-3.5 h-3.5 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {status === 'success' && <span>✓</span>}
                  {status === 'error' && <span>✗</span>}
                  <span>
                    {status === 'error' ? error : STATUS_MESSAGES[status]}
                  </span>
                </div>
              )}

              {/* Tx hash link */}
              {txHash && (
                <a
                  href={`https://polygonscan.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-accent hover:underline flex items-center gap-1"
                >
                  View on Polygonscan ↗
                </a>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-ep-border/50 flex gap-3">
              {status === 'success' || hasNothing ? (
                <button
                  onClick={onClose}
                  className="flex-1 btn-accent px-4 py-2.5 rounded-xl text-sm font-bold"
                >
                  {status === 'success' ? 'Done' : 'Close'}
                </button>
              ) : (
                <>
                  <button
                    onClick={onClose}
                    disabled={isProcessing}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold
                      bg-ep-surface/50 text-text-secondary border border-ep-border/50
                      hover:text-text-primary transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleWithdraw}
                    disabled={!isValid || isProcessing}
                    className="flex-1 btn-accent px-4 py-2.5 rounded-xl text-sm font-bold
                      disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Processing...
                      </>
                    ) : (
                      `Withdraw $${amountNum > 0 ? amountNum.toFixed(2) : '0.00'} ${selectedLabel}`
                    )}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
