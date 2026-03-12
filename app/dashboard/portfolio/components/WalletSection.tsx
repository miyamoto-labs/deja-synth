'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useUsdcBalance } from '@/app/lib/hooks/useUsdcBalance';
import { useOnchainBalance } from '@/app/lib/hooks/useOnchainBalance';
import { timeAgo } from '@/app/lib/utils/timeAgo';

interface Transfer {
  type: 'deposit' | 'withdraw';
  amount: number;
  from: string;
  to: string;
  txHash: string;
  timestamp: string;
  tokenSymbol: string;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

interface WalletSectionProps {
  walletAddress: string;
  onWithdraw: () => void;
}

export function WalletSection({ walletAddress, onWithdraw }: WalletSectionProps) {
  const { balance: clobBalance, formatted: clobFormatted, loading: clobLoading } = useUsdcBalance();
  const { usdc: onchainUsdc, usdce: onchainUsdce } = useOnchainBalance();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch(`/api/wallet/history?wallet=${walletAddress}`);
      if (res.ok) {
        const data = await res.json();
        setTransfers(data.transfers || []);
      }
    } catch {
      // Non-critical
    } finally {
      setTransfersLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleCopy = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // On-chain native USDC that someone sent by mistake
  const hasStuckUsdc = onchainUsdc !== null && onchainUsdc > 0;

  return (
    <div className="space-y-6">
      {/* Trading Balance */}
      <div className="ep-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">Trading Balance</p>
            <p className="text-2xl font-mono font-bold text-text-primary mt-1">
              {clobLoading ? '...' : (clobFormatted ?? '$0.00')}
            </p>
            <p className="text-[10px] text-text-muted mt-2">USDC.e available on Polymarket</p>
          </div>
        </div>
      </div>

      {/* Native USDC warning — only appears if someone sent USDC instead of USDC.e */}
      {hasStuckUsdc && (
        <div className="ep-card p-4 border border-yellow-500/30 bg-yellow-500/[0.04]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-yellow-400 flex items-center gap-1.5">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                Native USDC detected — ${onchainUsdc!.toFixed(2)}
              </p>
              <p className="text-[11px] text-text-muted mt-1">
                Native USDC can&apos;t be used for trading. Only USDC.e works on Polymarket. You can withdraw it to another wallet.
              </p>
            </div>
            <button
              onClick={onWithdraw}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-yellow-500/30 text-yellow-400
                bg-yellow-500/[0.06] hover:bg-yellow-500/15 transition shrink-0 mt-0.5"
            >
              Withdraw
            </button>
          </div>
        </div>
      )}

      {/* Deposit address */}
      <div className="ep-card p-5 sm:p-6">
        <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-2">
          Deposit Address (Polygon)
        </p>
        <div className="flex items-center gap-2">
          <code className="text-[11px] font-mono bg-ep-surface px-3 py-2 rounded-lg border border-ep-border text-text-secondary break-all flex-1">
            {walletAddress}
          </code>
          <button
            onClick={handleCopy}
            className="shrink-0 text-[10px] px-3 py-2 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition font-bold"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="text-[10px] text-text-muted mt-1.5">
          Only send USDC.e on Polygon to this address
        </p>
      </div>

      {/* Transfer History */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">Transfer History</h3>

        {transfersLoading ? (
          <div className="ep-card p-6 text-center">
            <svg className="mx-auto h-5 w-5 animate-spin text-text-muted" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : transfers.length > 0 ? (
          <div className="space-y-2">
            {transfers.map((tx, i) => (
              <motion.div
                key={tx.txHash}
                className="ep-card p-3 sm:p-4"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      tx.type === 'deposit'
                        ? 'bg-profit/10 text-profit'
                        : 'bg-accent/10 text-accent'
                    }`}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        {tx.type === 'deposit' ? (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                        )}
                      </svg>
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary">
                        {tx.type === 'deposit' ? 'Deposit' : 'Withdrawal'}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-text-muted mt-0.5">
                        <span>
                          {tx.type === 'deposit' ? 'from' : 'to'}{' '}
                          <span className="font-mono">{truncateAddress(tx.type === 'deposit' ? tx.from : tx.to)}</span>
                        </span>
                        <span>·</span>
                        <a
                          href={`https://polygonscan.com/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline"
                        >
                          View tx
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className={`font-mono text-sm font-bold ${
                      tx.type === 'deposit' ? 'text-profit' : 'text-text-primary'
                    }`}>
                      {tx.type === 'deposit' ? '+' : '-'}${tx.amount.toFixed(2)}
                    </div>
                    <div className="text-[11px] text-text-muted">
                      {timeAgo(tx.timestamp)}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="ep-card p-6 text-center">
            <div className="text-2xl mb-2">💸</div>
            <p className="text-text-secondary text-sm">No transfers yet</p>
            <p className="text-text-muted text-xs mt-1">
              Deposit USDC.e to your wallet to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
