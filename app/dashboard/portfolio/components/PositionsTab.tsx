'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/app/components/ui/Toast';
import { useClobClient } from '@/app/lib/hooks/useClobClient';
import { useUsdcBalance } from '@/app/lib/hooks/useUsdcBalance';
import { useUserStore } from '@/app/lib/stores/user-store';
import { timeAgo } from '@/app/lib/utils/timeAgo';
import { PnlShareButton } from '@/app/components/ui/PnlShareButton';
import type { SellPosition } from '@/app/components/ui/SellPositionModal';
import type { RedeemPosition } from '@/app/components/ui/RedeemModal';

export interface Position {
  id: string;
  question: string;
  outcome: string;
  size: number;
  avgPrice: number;
  curPrice: number;
  livePrice: number | null;
  currentValue: number;
  initialValue: number;
  pnl: number;
  pnlPercent: number;
  slug: string;
  assetId: string;
  conditionId: string;
  sellDisabled?: boolean;
  sellDisabledReason?: string;
  resolved?: boolean;
  redeemable?: boolean;
  negRisk?: boolean;
  outcomeIndex?: number;
  polymarketUrl?: string;
  createdAt?: string | null;
  resolvedAt?: string | null;
}

export interface OpenOrder {
  id: string;
  status: string;
  owner: string;
  maker_address: string;
  market: string;
  asset_id: string;
  side: string;
  original_size: string;
  size_matched: string;
  price: string;
  associate_trades: string[];
  outcome: string;
  created_at: number;
  expiration: string;
  order_type: string;
}

interface PositionsTabProps {
  positions: Position[];
  positionsError: boolean;
  openOrders: OpenOrder[];
  setSellTarget: (pos: SellPosition | null) => void;
  setRedeemTarget: (pos: RedeemPosition | null) => void;
  onDataRefresh: () => void;
  onOpenOrdersRefresh: () => void;
}

export function PositionsTab({
  positions,
  positionsError,
  openOrders,
  setSellTarget,
  setRedeemTarget,
  onDataRefresh,
  onOpenOrdersRefresh,
}: PositionsTabProps) {
  const [subTab, setSubTab] = useState<'active' | 'open' | 'closed'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'value' | 'pnl'>('value');
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancellingAll, setCancellingAll] = useState(false);
  const { toast } = useToast();
  const { cancelOrder, cancelAllOrders, isReady: clobReady } = useClobClient();
  const { refetch: refetchBalance } = useUsdcBalance();
  const { walletAddress } = useUserStore();

  const activePos = positions.filter((p) => !p.resolved);
  const resolvedPos = positions.filter((p) => p.resolved);

  // Filter + sort for closed positions
  const filteredResolved = resolvedPos
    .filter((p) => !searchQuery || p.question.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'pnl') return b.pnl - a.pnl;
      return Math.abs(b.currentValue) - Math.abs(a.currentValue);
    });

  const markCancelledInDb = useCallback(async (wallet: string, orderIds?: string[]) => {
    try {
      await fetch('/api/trades/mark-cancelled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: wallet, orderIds }),
      });
    } catch {
      // Non-critical
    }
  }, []);

  const handleCancelOrder = useCallback(async (orderID: string) => {
    if (!cancelOrder) {
      toast('error', 'Not Ready', 'Trading session not initialized. Try refreshing.');
      return;
    }
    setCancellingOrderId(orderID);
    try {
      await cancelOrder(orderID);
      toast('success', 'Order Cancelled', 'Your open order has been cancelled.');
      if (walletAddress) markCancelledInDb(walletAddress, [orderID]);
      onOpenOrdersRefresh();
      onDataRefresh();
      setTimeout(() => refetchBalance(), 2000);
    } catch (err: any) {
      toast('error', 'Cancel Failed', err?.message || 'Could not cancel order.');
    }
    setCancellingOrderId(null);
  }, [cancelOrder, walletAddress, markCancelledInDb, onOpenOrdersRefresh, onDataRefresh, refetchBalance, toast]);

  const handleCancelAll = useCallback(async () => {
    if (!cancelAllOrders) {
      toast('error', 'Not Ready', 'Trading session not initialized. Try refreshing.');
      return;
    }
    setCancellingAll(true);
    try {
      await cancelAllOrders();
      toast('success', 'All Orders Cancelled', 'All open orders cancelled.');
      if (walletAddress) markCancelledInDb(walletAddress);
      onOpenOrdersRefresh();
      onDataRefresh();
      setTimeout(() => refetchBalance(), 2000);
      setTimeout(() => refetchBalance(), 5000);
    } catch (err: any) {
      toast('error', 'Cancel Failed', err?.message || 'Could not cancel orders.');
    }
    setCancellingAll(false);
  }, [cancelAllOrders, walletAddress, markCancelledInDb, onOpenOrdersRefresh, onDataRefresh, refetchBalance, toast]);

  return (
    <div className="space-y-4">
      {/* Positions API Warning */}
      {positionsError && (
        <div className="ep-card p-4 border border-yellow-500/20 bg-yellow-500/[0.04] flex items-start gap-3">
          <svg className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-yellow-400">Could not load live positions</p>
            <p className="text-xs text-text-muted mt-0.5">
              Polymarket&apos;s API is temporarily unavailable. Positions will load automatically when the API recovers.
            </p>
          </div>
        </div>
      )}

      {/* Sub-tab switcher */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 p-1 bg-ep-border/30 rounded-lg w-fit">
          <button
            onClick={() => setSubTab('active')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              subTab === 'active' ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Active ({activePos.length})
          </button>
          <button
            onClick={() => setSubTab('open')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              subTab === 'open' ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Open ({openOrders.length})
          </button>
          <button
            onClick={() => setSubTab('closed')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              subTab === 'closed' ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Closed ({resolvedPos.length})
          </button>
        </div>

        {/* Cancel All — shown on Open tab */}
        {subTab === 'open' && clobReady && openOrders.length > 0 && (
          <button
            onClick={handleCancelAll}
            disabled={cancellingAll}
            className="text-xs text-loss hover:text-loss/80 disabled:opacity-50 transition px-3 py-1.5 rounded-lg border border-loss/20 hover:bg-loss/10"
          >
            {cancellingAll ? 'Cancelling...' : 'Cancel All Open'}
          </button>
        )}
      </div>

      {/* Search + sort for closed tab */}
      {subTab === 'closed' && resolvedPos.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="Search positions"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-ep-surface/50 border border-ep-border/50 text-sm text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent/40 transition"
            />
          </div>
          <button
            onClick={() => setSortBy(sortBy === 'pnl' ? 'value' : 'pnl')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-ep-border/50 text-xs text-text-muted hover:text-text-primary transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5-4.5L16.5 16.5m0 0L12 12m4.5 4.5V3" />
            </svg>
            {sortBy === 'pnl' ? 'Profit/Loss' : 'Value'}
          </button>
        </div>
      )}

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {subTab === 'active' && (
          <motion.div
            key="active"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.15 }}
          >
            {activePos.length > 0 ? (
              <div className="space-y-3">
                {activePos.map((pos, i) => (
                  <motion.div
                    key={pos.id}
                    className="ep-card p-4"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          {pos.polymarketUrl ? (
                            <a
                              href={pos.polymarketUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-text-primary leading-snug truncate sm:whitespace-normal flex-1 hover:text-accent transition"
                              title="View on Polymarket"
                            >
                              {pos.question}
                            </a>
                          ) : (
                            <p className="text-sm font-medium text-text-primary leading-snug truncate sm:whitespace-normal flex-1">
                              {pos.question}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                          {pos.outcome && (() => {
                            const ou = pos.outcome.toUpperCase();
                            const isPositive = ou !== "NO" && ou !== "DOWN";
                            return (
                              <span className={`rounded px-2 py-0.5 font-bold ${
                                isPositive
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-red-500/20 text-red-400"
                              }`}>
                                {ou}
                              </span>
                            );
                          })()}
                          <span className="text-text-muted">
                            Entry{" "}
                            <span className="font-mono text-text-secondary">
                              {(pos.avgPrice * 100).toFixed(1)}¢
                            </span>
                          </span>
                          <span className="text-text-muted flex items-center gap-1">
                            Current{" "}
                            <span className="font-mono text-text-secondary">
                              {(pos.curPrice * 100).toFixed(1)}¢
                            </span>
                            {pos.livePrice != null && (
                              <span className="h-1.5 w-1.5 rounded-full bg-profit animate-pulse" title="Live price" />
                            )}
                          </span>
                          <span className="text-text-muted">
                            Shares{" "}
                            <span className="font-mono text-text-secondary">
                              {pos.size.toFixed(1)}
                            </span>
                          </span>
                          {pos.createdAt && (
                            <span className="text-text-muted/60" title={new Date(pos.createdAt).toLocaleString()}>
                              {timeAgo(pos.createdAt)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                        <div>
                          <div className="font-mono text-sm font-bold text-text-primary">
                            ${pos.currentValue.toFixed(2)}
                          </div>
                          <div className={`font-mono text-[11px] ${
                            pos.pnl >= 0 ? "text-profit" : "text-loss"
                          }`}>
                            {pos.pnl >= 0 ? "+" : ""}${pos.pnl.toFixed(2)} ({pos.pnlPercent >= 0 ? "+" : ""}{pos.pnlPercent.toFixed(1)}%)
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <PnlShareButton position={pos} />
                          {pos.sellDisabled ? (
                            <span
                              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-ep-border text-text-muted cursor-not-allowed"
                              title={pos.sellDisabledReason || "Cannot close this position"}
                            >
                              Close
                            </span>
                          ) : (
                            <button
                              onClick={() => setSellTarget(pos)}
                              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-loss/30 text-loss hover:bg-loss/10 transition"
                            >
                              Close
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="ep-card p-8 text-center">
                <div className="text-2xl mb-2">📭</div>
                <p className="text-text-secondary text-sm">No open positions</p>
                <p className="text-text-muted text-xs mt-1">
                  Positions will appear here when you trade on Polymarket
                </p>
              </div>
            )}
          </motion.div>
        )}

        {subTab === 'open' && (
          <motion.div
            key="open"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.15 }}
          >
            {openOrders.length > 0 ? (
              <div className="space-y-3">
                {openOrders.map((order, i) => {
                  const originalSize = parseFloat(order.original_size) || 0;
                  const sizeMatched = parseFloat(order.size_matched) || 0;
                  const sizeRemaining = originalSize - sizeMatched;
                  const price = parseFloat(order.price) || 0;
                  const isBuy = order.side === 'BUY';
                  const outcomeUpper = (order.outcome || '').toUpperCase();
                  const isYes = outcomeUpper !== 'NO' && outcomeUpper !== 'DOWN' && outcomeUpper !== '';

                  return (
                    <motion.div
                      key={order.id}
                      className="ep-card p-4"
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-text-primary leading-snug truncate sm:whitespace-normal">
                            {order.market || order.asset_id.slice(0, 16) + '...'}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                            {order.outcome && (
                              <span className={`rounded px-2 py-0.5 font-bold ${
                                isYes
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-red-500/20 text-red-400"
                              }`}>
                                {outcomeUpper || 'YES'}
                              </span>
                            )}
                            <span className={`rounded px-2 py-0.5 font-bold ${
                              isBuy
                                ? "bg-blue-500/20 text-blue-400"
                                : "bg-orange-500/20 text-orange-400"
                            }`}>
                              {order.side}
                            </span>
                            <span className="text-text-muted">
                              Limit{" "}
                              <span className="font-mono text-text-secondary">
                                {(price * 100).toFixed(1)}¢
                              </span>
                            </span>
                            <span className="text-text-muted">
                              Size{" "}
                              <span className="font-mono text-text-secondary">
                                {originalSize.toFixed(1)}
                              </span>
                            </span>
                            {sizeMatched > 0 && (
                              <span className="text-profit">
                                Filled{" "}
                                <span className="font-mono">
                                  {sizeMatched.toFixed(1)}
                                </span>
                              </span>
                            )}
                            <span className="text-text-muted">
                              Remaining{" "}
                              <span className="font-mono text-text-secondary">
                                {sizeRemaining.toFixed(1)}
                              </span>
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                          <div>
                            <div className="font-mono text-sm font-bold text-text-primary">
                              ${(sizeRemaining * price).toFixed(2)}
                            </div>
                            <div className="text-[10px] text-text-muted mt-0.5">
                              {order.order_type}
                            </div>
                          </div>
                          <button
                            onClick={() => handleCancelOrder(order.id)}
                            disabled={cancellingOrderId === order.id}
                            className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-loss/30 text-loss hover:bg-loss/10 disabled:opacity-50 transition"
                          >
                            {cancellingOrderId === order.id ? 'Cancelling...' : 'Cancel'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="ep-card p-8 text-center">
                <div className="text-2xl mb-2">📋</div>
                <p className="text-text-secondary text-sm">No open orders</p>
                <p className="text-text-muted text-xs mt-1">
                  GTC limit orders that haven&apos;t fully filled will appear here
                </p>
              </div>
            )}
          </motion.div>
        )}

        {subTab === 'closed' && (
          <motion.div
            key="closed"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            {filteredResolved.length > 0 ? (
              <div className="space-y-3">
                {/* Summary */}
                <p className="text-xs text-text-muted">
                  {resolvedPos.filter((p) => p.curPrice > 0.5).length} won, {resolvedPos.filter((p) => p.curPrice <= 0.5).length} lost
                </p>
                {filteredResolved.map((pos, i) => {
                  const won = pos.curPrice > 0.5;
                  return (
                    <motion.div
                      key={pos.id}
                      className="ep-card p-4"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {/* Won/Lost badge */}
                            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              won
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-red-500/15 text-red-400"
                            }`}>
                              {won ? "Won" : "Lost"}
                            </span>
                            <p className="text-sm font-medium text-text-primary leading-snug truncate sm:whitespace-normal flex-1">
                              {pos.question}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-text-muted">
                            <span className="font-mono">{pos.size.toFixed(1)} shares at {(pos.avgPrice * 100).toFixed(1)}¢</span>
                            {pos.createdAt && (
                              <span className="text-text-muted/60" title={new Date(pos.createdAt).toLocaleString()}>
                                Opened {timeAgo(pos.createdAt)}
                              </span>
                            )}
                            {pos.resolvedAt && (
                              <span className="text-text-muted/60" title={new Date(pos.resolvedAt).toLocaleString()}>
                                Closed {timeAgo(pos.resolvedAt)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                          <div>
                            <div className="font-mono text-sm font-bold text-text-primary">
                              ${pos.currentValue.toFixed(2)}
                            </div>
                            <div className={`font-mono text-[11px] ${
                              pos.pnl >= 0 ? "text-profit" : "text-loss"
                            }`}>
                              {pos.pnl >= 0 ? "+" : ""}${pos.pnl.toFixed(2)} ({pos.pnlPercent >= 0 ? "+" : ""}{pos.pnlPercent.toFixed(1)}%)
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <PnlShareButton position={pos} />
                            {won && pos.redeemable && pos.conditionId ? (
                              <button
                                onClick={() => setRedeemTarget({
                                  id: pos.id,
                                  question: pos.question,
                                  outcome: pos.outcome,
                                  size: pos.size,
                                  avgPrice: pos.avgPrice,
                                  curPrice: pos.curPrice,
                                  currentValue: pos.currentValue,
                                  initialValue: pos.initialValue,
                                  pnl: pos.pnl,
                                  pnlPercent: pos.pnlPercent,
                                  conditionId: pos.conditionId,
                                  negRisk: pos.negRisk ?? false,
                                  assetId: pos.assetId,
                                  outcomeIndex: pos.outcomeIndex,
                                })}
                                className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-profit/30 text-profit hover:bg-profit/10 transition"
                              >
                                Redeem
                              </button>
                            ) : won && pos.conditionId && !pos.redeemable ? (
                              <span
                                className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-yellow-500/20 text-yellow-400/80 cursor-default"
                                title="Market resolved — waiting for on-chain settlement"
                              >
                                Settling...
                              </span>
                            ) : won ? (
                              <span
                                className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-profit/20 text-profit/60 cursor-default"
                                title="Position already redeemed"
                              >
                                Redeemed
                              </span>
                            ) : (
                              <span
                                className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-loss/20 text-loss/60 cursor-default"
                                title="Market resolved against your position"
                              >
                                Lost
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : resolvedPos.length > 0 ? (
              <div className="ep-card p-8 text-center">
                <p className="text-text-muted text-sm">No positions match &quot;{searchQuery}&quot;</p>
              </div>
            ) : (
              <div className="ep-card p-8 text-center">
                <div className="text-2xl mb-2">📊</div>
                <p className="text-text-secondary text-sm">No closed positions</p>
                <p className="text-text-muted text-xs mt-1">
                  Resolved markets will appear here
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
