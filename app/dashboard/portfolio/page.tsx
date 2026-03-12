"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import StatsGrid from "../components/StatsGrid";
import { WalletConnectButton } from "@/app/components/ui";
import { useUserStore } from "@/app/lib/stores/user-store";
import Link from "next/link";
import { useUsdcBalance } from "@/app/lib/hooks/useUsdcBalance";
import { SellPositionModal, type SellPosition } from "@/app/components/ui/SellPositionModal";
import { RedeemModal, type RedeemPosition } from "@/app/components/ui/RedeemModal";
import { useRedeem } from "@/app/lib/hooks/useRedeem";
import { WithdrawModal } from "@/app/components/ui/WithdrawModal";
import { useToast } from "@/app/components/ui/Toast";
import { PositionsTab, type Position, type OpenOrder } from "./components/PositionsTab";
import { ActivityTab } from "./components/ActivityTab";
import { WalletSection } from "./components/WalletSection";
import { useClobClient } from "@/app/lib/hooks/useClobClient";

interface Trade {
  id: string;
  side: string;
  direction: string;
  amount: number;
  price: number;
  shares: number;
  order_id: string;
  created_at: string;
  source: string | null;
  token_id?: string;
  market_question?: string | null;
  market_category?: string | null;
  realized_pnl?: number | null;
  resolved_at?: string | null;
}

interface PortfolioStats {
  totalValue: number;
  unrealizedPnl: number;
  winRate: number;
  totalTrades: number;
  activePositions: number;
  volumeAllTime?: number;
  volumeMonth?: number;
  volumeWeek?: number;
  volumeDay?: number;
}

interface CopyTrader {
  trader_id: string;
  auto_trade: boolean;
  amount_per_trade: number;
  max_daily_trades: number;
  total_spent?: number;
  total_spend_limit?: number;
  trader: {
    alias: string;
    roi: number;
    win_rate: number;
    bankroll_tier: string;
  } | null;
}

interface CopyActivity {
  id: string;
  signal_id: string;
  trader_id: string;
  status: 'executed' | 'failed' | 'skipped';
  order_id?: string;
  amount?: number;
  market_slug?: string;
  market_question?: string;
  side?: string;
  direction?: string;
  price?: number;
  trader_alias?: string;
  error_message?: string;
  created_at: string;
}

type TabId = 'positions' | 'activity' | 'wallet';

export default function PortfolioPage() {
  const { walletAddress, isConnected, follows } = useUserStore();
  const { balance: usdcBalance, formatted: balanceFormatted, loading: balanceLoading, refetch: refetchBalance } = useUsdcBalance();
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [positionsError, setPositionsError] = useState(false);
  const [volumePeriod, setVolumePeriod] = useState<'day' | 'week' | 'month' | 'all'>('all');
  const [sellTarget, setSellTarget] = useState<SellPosition | null>(null);
  const [redeemTarget, setRedeemTarget] = useState<RedeemPosition | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [copyTraders, setCopyTraders] = useState<CopyTrader[]>([]);
  const [copyActivity, setCopyActivity] = useState<CopyActivity[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('positions');
  const { toast } = useToast();
  const { getOpenOrders } = useClobClient();
  const { redeem, isReady: redeemReady } = useRedeem();
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const autoRedeemedRef = useRef<Set<string>>(new Set());
  const autoRedeemingRef = useRef(false);
  const [livePrices, setLivePrices] = useState<
    Record<string, { yes: number; no: number; yesToken: string; noToken: string }>
  >({});

  const activeCopyTraders = useMemo(() => copyTraders.filter((t) => t.auto_trade), [copyTraders]);

  // ── Record redemption in DB so it shows in Closed tab ──
  const recordRedeem = useCallback(async (pos: { assetId?: string; size: number; avgPrice: number; curPrice: number }) => {
    if (!walletAddress || !pos.assetId) return;
    try {
      await fetch("/api/trades/record-redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          tokenId: pos.assetId,
          shares: pos.size,
          avgPrice: pos.avgPrice,
          won: pos.curPrice > 0.5,
        }),
      });
    } catch {
      // Non-critical — position still redeemed on-chain
    }
  }, [walletAddress]);

  // ── Data Fetching ────────────────────────────────

  const fetchLivePrices = useCallback(async (positionList: Position[]) => {
    const slugs = positionList
      .map((p) => p.slug || p.conditionId)
      .filter(Boolean);
    const unique = [...new Set(slugs)];
    if (unique.length === 0) return;

    try {
      const res = await fetch(`/api/dashboard/picks/prices?ids=${unique.join(",")}`);
      if (res.ok) {
        const data = await res.json();
        setLivePrices(data.prices || {});
      }
    } catch {
      // Non-critical
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch(`/api/dashboard/portfolio?wallet=${walletAddress}`);
      if (res.ok) {
        const data = await res.json();
        const newPositions = data.positions || [];
        setPositions(newPositions);
        setTrades(data.trades || []);
        setStats(data.stats || null);
        setPositionsError(!!data.positionsError);
        fetchLivePrices(newPositions);
      }
    } catch (err) {
      console.error("Portfolio fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, fetchLivePrices]);

  const fetchCopyTraders = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch(`/api/follows/list?walletAddress=${walletAddress}`);
      if (res.ok) {
        const data = await res.json();
        setCopyTraders(data.follows || []);
      }
    } catch {
      // Non-critical
    }
  }, [walletAddress]);

  const fetchCopyActivity = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch(`/api/copytrade/activity?wallet=${walletAddress}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setCopyActivity(data.activity || []);
      }
    } catch {
      // Non-critical
    }
  }, [walletAddress]);

  // Cache resolved market questions so we don't re-fetch every 30s
  const marketQuestionCache = useRef<Map<string, string>>(new Map());

  const fetchOpenOrders = useCallback(async () => {
    if (!getOpenOrders) return;
    try {
      const orders = await getOpenOrders();
      if (!orders || orders.length === 0) { setOpenOrders([]); return; }

      // Build tokenId→question map from current positions + cache
      const tokenToQuestion = new Map<string, string>(marketQuestionCache.current);
      for (const p of positionsRef.current) {
        if (p.assetId && p.question) tokenToQuestion.set(p.assetId, p.question);
      }

      // Find condition IDs for orders we can't resolve from positions
      const unknownConditionIds = new Set<string>();
      for (const order of orders) {
        if (!tokenToQuestion.has(order.asset_id) && order.market) {
          unknownConditionIds.add(order.market);
        }
      }

      // Resolve unknown condition IDs via Gamma API
      if (unknownConditionIds.size > 0) {
        try {
          const gammaResults = await Promise.allSettled(
            [...unknownConditionIds].map(async (condId) => {
              const res = await fetch(
                `https://gamma-api.polymarket.com/markets?condition_id=${condId}&limit=10`,
                { cache: 'no-store' },
              );
              if (!res.ok) return null;
              return res.json();
            }),
          );

          for (const result of gammaResults) {
            if (result.status !== 'fulfilled' || !result.value) continue;
            const markets = Array.isArray(result.value) ? result.value : [result.value];
            for (const mkt of markets) {
              if (!mkt?.question) continue;
              try {
                const tokens = typeof mkt.clobTokenIds === 'string'
                  ? JSON.parse(mkt.clobTokenIds)
                  : mkt.clobTokenIds;
                if (Array.isArray(tokens)) {
                  for (const tid of tokens) {
                    if (tid) {
                      tokenToQuestion.set(tid, mkt.question);
                      marketQuestionCache.current.set(tid, mkt.question);
                    }
                  }
                }
              } catch { /* skip malformed */ }
            }
          }
        } catch { /* Non-critical — orders still show, just with condition IDs */ }
      }

      // Enrich orders with resolved market questions
      const enriched = orders.map((o: OpenOrder) => ({
        ...o,
        market: tokenToQuestion.get(o.asset_id) || o.market,
      }));

      setOpenOrders(enriched);
    } catch {
      // Non-critical — CLOB client may not be ready
    }
  }, [getOpenOrders]);

  const resolveTradesOnce = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch("/api/trades/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.resolved > 0) fetchData();
      }
    } catch {
      // Non-critical
    }
  }, [walletAddress, fetchData]);

  const positionsRef = useRef<Position[]>([]);
  useEffect(() => { positionsRef.current = positions; }, [positions]);

  useEffect(() => {
    if (!isConnected || !walletAddress) {
      setLoading(false);
      return;
    }
    fetchData();
    fetchCopyTraders();
    fetchCopyActivity();
    fetchOpenOrders();
    resolveTradesOnce();
    const dataInterval = setInterval(fetchData, 30000);
    const priceInterval = setInterval(() => {
      if (positionsRef.current.length > 0) fetchLivePrices(positionsRef.current);
    }, 15000);
    const activityInterval = setInterval(fetchCopyActivity, 15000);
    const openOrdersInterval = setInterval(fetchOpenOrders, 30000);
    return () => {
      clearInterval(dataInterval);
      clearInterval(priceInterval);
      clearInterval(activityInterval);
      clearInterval(openOrdersInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, fetchCopyTraders, fetchCopyActivity, fetchOpenOrders, fetchLivePrices, resolveTradesOnce, isConnected, walletAddress]);

  // ── Auto-redeem resolved WINNING positions ────
  useEffect(() => {
    if (!redeemReady || autoRedeemingRef.current) return;

    // Only auto-redeem when the on-chain oracle has finalized (redeemable),
    // not just when the market outcome is known (resolved).
    const resolvedWinners = positions.filter((p) => {
      if (!p.redeemable || !p.conditionId) return false;
      if (autoRedeemedRef.current.has(p.conditionId)) return false;
      return p.curPrice > 0.5;
    });

    if (resolvedWinners.length === 0) return;

    autoRedeemingRef.current = true;
    (async () => {
      for (const pos of resolvedWinners) {
        autoRedeemedRef.current.add(pos.conditionId);
        toast('info', 'Auto-Redeeming', `Redeeming winnings for "${pos.question.slice(0, 50)}..."`);
        try {
          const success = await redeem(pos.conditionId, pos.negRisk ?? false, pos.assetId, pos.outcomeIndex);
          if (success) {
            await recordRedeem(pos);
            const redemptionValue = pos.size * 1.0;
            toast('success', 'Redeemed!', `Collected $${redemptionValue.toFixed(2)} USDC from "${pos.question.slice(0, 40)}..."`);
          } else {
            toast('error', 'Redeem Failed', `Could not auto-redeem "${pos.question.slice(0, 40)}...". Try manually.`);
          }
        } catch {
          toast('error', 'Redeem Failed', `Error redeeming "${pos.question.slice(0, 40)}...". Try manually.`);
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      autoRedeemingRef.current = false;
      fetchData();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, redeemReady]);

  // Merge live prices into positions
  const enrichedPositions = useMemo(() => {
    if (Object.keys(livePrices).length === 0) return positions;
    return positions.map((pos) => {
      const key = pos.slug || pos.conditionId;
      const lp = key ? livePrices[key] : null;
      if (!lp) return pos;

      const outcomeUpper = pos.outcome?.toUpperCase() || "";
      // For NegRisk named outcomes (e.g. "PARIVISION"), the outcome IS the
      // YES side of that binary sub-market. Only "NO"/"DOWN" = NO side.
      const isYes = outcomeUpper !== "NO" && outcomeUpper !== "DOWN";
      const livePrice = isYes ? lp.yes : lp.no;

      let assetId = pos.assetId;
      if (!assetId) {
        assetId = isYes ? lp.yesToken : lp.noToken;
      }

      const curPrice = livePrice || pos.curPrice;
      const currentValue = pos.size * curPrice;
      const pnl = currentValue - pos.initialValue;
      const pnlPercent = pos.initialValue > 0 ? (pnl / pos.initialValue) * 100 : 0;

      return {
        ...pos,
        curPrice,
        livePrice,
        assetId,
        currentValue: Math.round(currentValue * 100) / 100,
        pnl: Math.round(pnl * 100) / 100,
        pnlPercent: Math.round(pnlPercent * 10) / 10,
        // Only override sellDisabled for active positions — resolved
        // positions already have it set correctly by the API.
        ...(pos.resolved ? {} : {
          sellDisabled: !assetId,
          sellDisabledReason: !assetId ? "Token ID could not be resolved" : "",
        }),
      };
    });
  }, [positions, livePrices]);

  // ── Wallet Gate ──
  if (!isConnected) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="ep-card p-8 sm:p-12 text-center max-w-md space-y-4">
          <div className="text-4xl">💼</div>
          <h2 className="font-display text-xl font-bold">Connect Your Wallet</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Log in to view your positions, trade history,
            and P&L in real time.
          </p>
          <WalletConnectButton variant="inline" />
        </div>
      </div>
    );
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-text-muted">
        <svg className="mr-2 h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading portfolio...
      </div>
    );
  }

  // Compute realized P&L
  const totalRealizedPnl = trades
    .filter((t) => t.realized_pnl != null)
    .reduce((sum, t) => sum + (t.realized_pnl || 0), 0);
  const resolvedTradeCount = trades.filter((t) => t.realized_pnl != null).length;
  const wonTradeCount = trades.filter((t) => t.realized_pnl != null && t.realized_pnl > 0).length;

  const statsCards = [
    {
      label: "USDC Balance",
      value: balanceLoading ? "..." : (balanceFormatted ?? "$0.00"),
      icon: "pnl",
      sub: usdcBalance !== null && usdcBalance < 1 ? "Fund wallet to trade" : "Available to trade or withdraw",
      trend: usdcBalance !== null && usdcBalance < 1 ? ("down" as const) : ("neutral" as const),
    },
    {
      label: "Portfolio Value",
      value: `$${(stats?.totalValue || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      icon: "markets",
      sub: `${stats?.activePositions || 0} active positions`,
    },
    {
      label: "Unrealized P&L",
      value: `${(stats?.unrealizedPnl || 0) >= 0 ? "+" : ""}$${(stats?.unrealizedPnl || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      icon: "winrate",
      sub: "Across open positions",
      trend: (stats?.unrealizedPnl || 0) > 0 ? ("up" as const) : (stats?.unrealizedPnl || 0) < 0 ? ("down" as const) : ("neutral" as const),
    },
    {
      label: "Realized P&L",
      value: `${totalRealizedPnl >= 0 ? "+" : ""}$${totalRealizedPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      icon: "picks",
      sub: resolvedTradeCount > 0 ? `${wonTradeCount}/${resolvedTradeCount} trades won` : "No resolved trades yet",
      trend: totalRealizedPnl > 0 ? ("up" as const) : totalRealizedPnl < 0 ? ("down" as const) : ("neutral" as const),
    },
  ];

  const volumeByPeriod = {
    day: stats?.volumeDay || 0,
    week: stats?.volumeWeek || 0,
    month: stats?.volumeMonth || 0,
    all: stats?.volumeAllTime || 0,
  };
  const volumeLabels: Record<string, string> = {
    day: "24h",
    week: "7d",
    month: "30d",
    all: "All Time",
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: 'positions', label: 'Positions' },
    { id: 'activity', label: 'Activity' },
    { id: 'wallet', label: 'Wallet' },
  ];

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────── */}
      <div className="flex items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold">Portfolio</h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            Your positions, trades, and wallet
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-text-muted">
          <span className="live-dot" />
          Auto-refreshing
        </div>
      </div>

      {/* ── Stats ───────────────────────────────── */}
      <div className="space-y-4">
        <StatsGrid stats={statsCards} />

        {/* Volume Traded — inline card with period dropdown */}
        <div className="rounded-xl border border-white/5 bg-brand-card p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-brand-green">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </span>
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-gray-400">Volume Traded</span>
              <p className="text-2xl font-bold mt-1">
                ${volumeByPeriod[volumePeriod].toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            {(["day", "week", "month", "all"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setVolumePeriod(p)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  volumePeriod === p
                    ? "bg-accent/15 text-accent"
                    : "text-text-muted hover:text-text-secondary hover:bg-white/5"
                }`}
              >
                {volumeLabels[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Fund Wallet Banner ── */}
      {usdcBalance !== null && usdcBalance < 1 && walletAddress && (
        <div className="ep-card p-4 border border-accent/20 bg-accent/[0.04]">
          <div className="flex items-start gap-3">
            <div className="text-xl shrink-0">💰</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">Fund Your Wallet</p>
              <p className="text-xs text-text-muted mt-0.5 mb-2">
                Send USDC.e on Polygon to your trading wallet to start placing bets:
              </p>
              <div className="flex items-center gap-2">
                <code className="text-[11px] font-mono bg-ep-surface px-2 py-1 rounded border border-ep-border text-text-secondary break-all">
                  {walletAddress}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(walletAddress)}
                  className="shrink-0 text-[10px] px-2 py-1 rounded bg-accent/10 text-accent hover:bg-accent/20 transition font-medium"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Primary Tabs ───────────────────────── */}
      <div className="flex gap-1 p-1 bg-ep-border/30 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              activeTab === tab.id
                ? 'bg-accent/10 text-accent'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ────────────────────────── */}
      <AnimatePresence mode="wait">
        {activeTab === 'positions' && (
          <motion.div
            key="positions"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <PositionsTab
              positions={enrichedPositions}
              positionsError={positionsError}
              openOrders={openOrders}
              setSellTarget={setSellTarget}
              setRedeemTarget={setRedeemTarget}
              onDataRefresh={() => { fetchData(); refetchBalance(); }}
              onOpenOrdersRefresh={fetchOpenOrders}
            />
          </motion.div>
        )}

        {activeTab === 'activity' && (
          <motion.div
            key="activity"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <ActivityTab trades={trades} copyActivity={copyActivity} walletAddress={walletAddress} />
          </motion.div>
        )}

        {activeTab === 'wallet' && walletAddress && (
          <motion.div
            key="wallet"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <WalletSection
              walletAddress={walletAddress}
              onWithdraw={() => setWithdrawOpen(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Currently Copytrading ────────────────── */}
      <div>
        {(() => {
          const totalCapital = activeCopyTraders.reduce((s, t) => s + (t.amount_per_trade || 0), 0);
          const totalSpent = activeCopyTraders.reduce((s, t) => s + (parseFloat(String(t.total_spent)) || 0), 0);
          const insufficientFunds = activeCopyTraders.length > 0 && usdcBalance !== null && usdcBalance < totalCapital;
          return (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg font-semibold">Currently Copytrading</h2>
                  {activeCopyTraders.length > 0 && (
                    <p className={`text-xs mt-0.5 ${insufficientFunds ? 'text-loss' : 'text-text-muted'}`}>
                      ${totalCapital} total capital per round
                      {totalSpent > 0 && ` · $${Math.round(totalSpent)} total spent`}
                      {insufficientFunds && ` · Balance: ${balanceFormatted}`}
                    </p>
                  )}
                </div>
                {activeCopyTraders.length > 0 && (
                  <Link
                    href="/dashboard/shadow"
                    className="text-xs text-accent hover:text-accent/80 transition font-medium"
                  >
                    View Signals →
                  </Link>
                )}
              </div>

              {insufficientFunds && (
                <div className="mb-3 rounded-xl border border-loss/30 bg-loss/5 px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <span className="text-base shrink-0 mt-0.5">⚠️</span>
                    <div>
                      <p className="text-sm font-semibold text-loss">Insufficient Funds</p>
                      <p className="text-xs text-loss/80 mt-0.5 leading-relaxed">
                        You need <span className="font-mono font-semibold">${totalCapital}</span> per round but only have{' '}
                        <span className="font-mono font-semibold">{balanceFormatted}</span>.
                        Reduce trade amounts or deposit more USDC.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {activeCopyTraders.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeCopyTraders.map((ct) => (
              <Link key={ct.trader_id} href="/dashboard/shadow">
                <motion.div
                  className="ep-card p-4 flex items-center gap-3 cursor-pointer hover:border-accent/30 transition-colors"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{
                      background: (ct.trader?.roi || 0) > 0 ? 'rgba(0,240,160,0.15)' : 'rgba(139,146,168,0.15)',
                      color: (ct.trader?.roi || 0) > 0 ? '#00F0A0' : '#8B92A8',
                      border: `2px solid ${(ct.trader?.roi || 0) > 0 ? 'rgba(0,240,160,0.3)' : 'rgba(139,146,168,0.3)'}`,
                    }}
                  >
                    {(ct.trader?.alias || '?')[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-text-primary truncate">
                        {ct.trader?.alias || 'Unknown'}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-bold">AUTO</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-muted">
                      <span className="font-mono font-semibold text-accent">${ct.amount_per_trade}/trade</span>
                      <span>·</span>
                      <span>{ct.max_daily_trades}/day max</span>
                      {ct.total_spend_limit && (
                        <>
                          <span>·</span>
                          <span className="font-mono">${Math.round(parseFloat(String(ct.total_spent)) || 0)}/${ct.total_spend_limit}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {ct.trader?.roi != null && (
                    <div className="text-right shrink-0">
                      <div className={`font-mono text-sm font-bold ${
                        ct.trader.roi > 0 ? 'text-profit' : ct.trader.roi < 0 ? 'text-loss' : 'text-text-muted'
                      }`}>
                        {ct.trader.roi > 0 ? '+' : ''}{ct.trader.roi.toFixed(0)}%
                      </div>
                      <div className="text-[10px] text-text-muted">ROI</div>
                    </div>
                  )}
                </motion.div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="ep-card p-6 text-center">
            <div className="text-2xl mb-2">👥</div>
            <p className="text-sm font-medium text-text-primary">Not copying anyone yet</p>
            <p className="text-xs text-text-muted mt-1 mb-3">
              Follow top traders and auto-copy their moves.
            </p>
            <Link
              href="/dashboard/traders"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-accent/10 text-accent hover:bg-accent/20 transition"
            >
              Browse Traders →
            </Link>
          </div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────── */}
      <SellPositionModal
        position={sellTarget}
        onClose={() => setSellTarget(null)}
        onSuccess={() => {
          fetchData();
          refetchBalance();
          // Refresh activity immediately + once more after a short delay
          // so the sell logged to ep_user_trades appears right away
          setTimeout(fetchCopyActivity, 500);
          setTimeout(() => { fetchData(); fetchCopyActivity(); }, 3000);
        }}
      />
      <RedeemModal
        position={redeemTarget}
        onClose={() => setRedeemTarget(null)}
        onSuccess={() => {
          if (redeemTarget) recordRedeem(redeemTarget);
          fetchData();
          refetchBalance();
          setTimeout(() => refetchBalance(), 5000);
        }}
      />
      <WithdrawModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        onSuccess={() => {
          refetchBalance();
          fetchData();
        }}
      />
    </div>
  );
}
