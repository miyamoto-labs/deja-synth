"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FilterBar, SortDropdown } from "@/app/components/ui";
import { LPPanel, type LPMarket } from "@/app/components/ui/LPPanel";

// ── Types ─────────────────────────────────────────
interface ScoredMarket {
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
  reward_per_1k: number;
  side_required: string;
  days_remaining: number;
}

interface EarnStats {
  total_markets: number;
  avg_mm_score: number;
  best_apy: number;
  total_daily_rewards: number;
}

// ── Filter & Sort Config ──────────────────────────
const riskOptions = [
  { value: "all", label: "All" },
  { value: "low", label: "Low Risk" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High Risk" },
];

const sortOptions = [
  { value: "mm_score", label: "MM Score" },
  { value: "est_apy", label: "Highest APY" },
  { value: "daily_reward", label: "Daily Reward" },
  { value: "fill_risk", label: "Lowest Fill Risk" },
  { value: "days_remaining", label: "Time Left" },
  { value: "min_size", label: "Lowest Min Size" },
];

function sortMarkets(items: ScoredMarket[], sortBy: string): ScoredMarket[] {
  const sorted = [...items];
  switch (sortBy) {
    case "est_apy":
      sorted.sort((a, b) => b.est_apy - a.est_apy);
      break;
    case "daily_reward":
      sorted.sort((a, b) => b.daily_reward - a.daily_reward);
      break;
    case "fill_risk":
      sorted.sort((a, b) => a.fill_risk - b.fill_risk);
      break;
    case "days_remaining":
      sorted.sort((a, b) => b.days_remaining - a.days_remaining);
      break;
    case "min_size":
      sorted.sort((a, b) => a.min_size - b.min_size);
      break;
    default: // mm_score
      sorted.sort((a, b) => b.mm_score - a.mm_score);
  }
  return sorted;
}

function getRiskCounts(markets: ScoredMarket[]): Record<string, number> {
  const counts: Record<string, number> = { all: markets.length };
  for (const m of markets) {
    counts[m.risk_tier] = (counts[m.risk_tier] || 0) + 1;
  }
  return counts;
}

// ═══════════════════════════════════════════════════
// Page Component
// ═══════════════════════════════════════════════════
export default function EarnPage() {
  const [markets, setMarkets] = useState<ScoredMarket[]>([]);
  const [stats, setStats] = useState<EarnStats | null>(null);
  const [scoredAt, setScoredAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [riskFilter, setRiskFilter] = useState("all");
  const [sortBy, setSortBy] = useState("mm_score");
  const [selectedMarket, setSelectedMarket] = useState<LPMarket | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/earn");
      const data = await res.json();
      setMarkets(data.markets || []);
      setStats(data.stats || null);
      setScoredAt(data.scored_at || null);
    } catch (err) {
      console.error("Earn fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(fetchData, 120_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/dashboard/earn/refresh", { method: "POST" });
      await fetchData();
    } catch {
      // silent
    } finally {
      setRefreshing(false);
    }
  };

  // ── Derived data ────────────────────────────────
  const riskCounts = useMemo(() => getRiskCounts(markets), [markets]);

  const riskOptionsWithCounts = useMemo(
    () => riskOptions.map((opt) => ({ ...opt, count: riskCounts[opt.value] || 0 })),
    [riskCounts]
  );

  const filteredMarkets = useMemo(() => {
    let filtered = markets;
    if (riskFilter !== "all") {
      filtered = filtered.filter((m) => m.risk_tier === riskFilter);
    }
    return sortMarkets(filtered, sortBy);
  }, [markets, riskFilter, sortBy]);

  // ── Render ──────────────────────────────────────
  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-text-primary">
            Earn
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            Provide liquidity to earn rewards on Polymarket
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary
                     bg-ep-card border border-ep-border hover:text-text-primary hover:border-accent/30 transition disabled:opacity-50"
        >
          <svg
            className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
            />
          </svg>
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Stats Row */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="ep-card p-4 animate-pulse">
              <div className="h-3 bg-ep-border/30 rounded w-20 mb-2" />
              <div className="h-6 bg-ep-border/30 rounded w-16" />
            </div>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Markets" value={stats.total_markets.toString()} />
          <StatCard label="Avg MM Score" value={stats.avg_mm_score.toFixed(0)} />
          <StatCard label="Best APY" value={`${stats.best_apy.toFixed(0)}%`} />
          <StatCard label="Total Daily" value={`$${stats.total_daily_rewards.toFixed(0)}`} />
        </div>
      ) : null}

      {/* Filters + Sort */}
      <div className="flex flex-wrap items-center gap-4">
        <FilterBar label="Risk" options={riskOptionsWithCounts} value={riskFilter} onChange={setRiskFilter} />
        <div className="ml-auto">
          <SortDropdown options={sortOptions} value={sortBy} onChange={setSortBy} />
        </div>
      </div>

      {/* Last updated */}
      {scoredAt && (
        <p className="text-[10px] text-text-muted/60">
          Last scored: {new Date(scoredAt).toLocaleString()}
        </p>
      )}

      {/* Market Cards */}
      {loading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <EarnCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredMarkets.length === 0 ? (
        <div className="ep-card p-12 text-center">
          <h3 className="font-display font-semibold text-text-primary">No markets found</h3>
          <p className="text-sm text-text-muted mt-1">
            {riskFilter !== "all"
              ? "Try a different risk filter."
              : "No LP reward markets available right now."}
          </p>
        </div>
      ) : (
        <motion.div
          key={`${riskFilter}-${sortBy}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {filteredMarkets.map((market) => (
            <EarnMarketCard
              key={market.condition_id}
              market={market}
              onSelect={() => setSelectedMarket(market as LPMarket)}
            />
          ))}
        </motion.div>
      )}

      {/* LP Panel */}
      <LPPanel
        market={selectedMarket}
        isOpen={!!selectedMarket}
        onClose={() => setSelectedMarket(null)}
      />
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="ep-card p-4">
      <span className="text-[10px] text-text-muted uppercase tracking-wider">{label}</span>
      <p className="font-mono font-bold text-accent text-lg mt-0.5">{value}</p>
    </div>
  );
}

// ── MM Score Circle ───────────────────────────────
function MMScoreCircle({ score }: { score: number }) {
  const color =
    score >= 70 ? "text-profit" : score >= 40 ? "text-accent" : "text-loss";
  const bgColor =
    score >= 70 ? "bg-profit/10" : score >= 40 ? "bg-accent/10" : "bg-loss/10";
  const borderColor =
    score >= 70 ? "border-profit/30" : score >= 40 ? "border-accent/30" : "border-loss/30";

  return (
    <div
      className={`w-11 h-11 rounded-full flex items-center justify-center border-2 ${bgColor} ${borderColor}`}
    >
      <span className={`font-mono font-bold text-sm ${color}`}>{score.toFixed(0)}</span>
    </div>
  );
}

// ── Risk Pill ─────────────────────────────────────
function RiskPill({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    low: "bg-profit/10 text-profit border-profit/20",
    medium: "bg-accent/10 text-accent border-accent/20",
    high: "bg-loss/10 text-loss border-loss/20",
  };
  return (
    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${styles[tier] || styles.high}`}>
      {tier}
    </span>
  );
}

// ── Earn Market Card ──────────────────────────────
function EarnMarketCard({
  market,
  onSelect,
}: {
  market: ScoredMarket;
  onSelect: () => void;
}) {
  return (
    <motion.div
      className="ep-card p-5 flex flex-col gap-3"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      {/* Top row: score + risk + time */}
      <div className="flex items-center gap-3">
        <MMScoreCircle score={market.mm_score} />
        <div className="flex-1 flex items-center gap-2">
          <RiskPill tier={market.risk_tier} />
          <span className="text-[10px] text-text-muted ml-auto">
            {market.days_remaining}d left
          </span>
        </div>
      </div>

      {/* Question */}
      <p className="text-sm text-text-primary font-medium line-clamp-2 leading-snug">
        {market.question}
      </p>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Reward/d" value={`$${market.daily_reward.toFixed(2)}`} />
        <MiniStat label="Est APY" value={`${market.est_apy.toFixed(0)}%`} accent />
        <MiniStat label="Fill Risk" value={`${market.fill_risk.toFixed(0)}%`} />
        <MiniStat label="Min Size" value={`$${market.min_size}`} />
        <MiniStat label="Rwd/$1k" value={`$${market.reward_per_1k.toFixed(2)}`} />
        <MiniStat label="Side" value={market.side_required} />
      </div>

      {/* CTA */}
      <button
        onClick={onSelect}
        className="w-full bg-accent/10 text-accent hover:bg-accent/20 rounded-lg px-4 py-2.5 text-xs font-bold
                   transition-colors flex items-center justify-center gap-1.5"
      >
        Provide Liquidity
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </button>
    </motion.div>
  );
}

// ── Mini Stat Cell ────────────────────────────────
function MiniStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-ep-bg/50 rounded-lg p-2.5">
      <span className="text-[9px] text-text-muted uppercase tracking-wider block">{label}</span>
      <span className={`font-mono text-sm ${accent ? "text-accent font-bold" : "text-text-primary"}`}>
        {value}
      </span>
    </div>
  );
}

// ── Card Skeleton ─────────────────────────────────
function EarnCardSkeleton() {
  return (
    <div className="ep-card p-5 animate-pulse space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-ep-border/30" />
        <div className="h-4 bg-ep-border/30 rounded w-16" />
      </div>
      <div className="h-4 bg-ep-border/30 rounded w-full" />
      <div className="h-4 bg-ep-border/30 rounded w-3/4" />
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 bg-ep-border/30 rounded-lg" />
        ))}
      </div>
      <div className="h-9 bg-ep-border/30 rounded-lg" />
    </div>
  );
}
