"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  StatCard,
  StatCardSkeleton,
  FilterBar,
  SortDropdown,
} from "@/app/components/ui";

/* ── Types ── */

interface ArbOpportunity {
  market_id: string;
  question: string;
  category: string;
  yes_price: number;
  no_price: number;
  yes_token: string;
  no_token: string;
  volume: number;
  liquidity: number;
  end_date: string;
  priceSum: number;
  spread: number;
  spreadPercent: number;
  profitPer100: number;
  arbType: "spread";
  riskLevel: "low" | "medium" | "high";
}

interface ArbStats {
  total_opportunities: number;
  avg_spread: number;
  best_profit: number;
  total_markets_scanned: number;
}

/* ── Helpers ── */

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatCents(price: number): string {
  return `${(price * 100).toFixed(1)}¢`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

/* ── Filter/Sort Options ── */

const filterOptions = [
  { value: "all", label: "All" },
  { value: "profitable", label: "Profitable" },
  { value: "high_liq", label: "High Liquidity" },
];

const sortOptions = [
  { value: "profit", label: "Profit" },
  { value: "spread", label: "Spread %" },
  { value: "volume", label: "Volume" },
  { value: "liquidity", label: "Liquidity" },
];

/* ── ArbOpportunityCard ── */

function ArbOpportunityCard({ opp }: { opp: ArbOpportunity }) {
  const riskColors = {
    low: "bg-profit/15 text-profit",
    medium: "bg-yellow-400/15 text-yellow-400",
    high: "bg-loss/15 text-loss",
  };

  const slug = opp.market_id;

  return (
    <motion.div
      className="ep-card p-5 hover:border-accent/20 transition-colors"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
    >
      {/* Top row: badges */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full ${riskColors[opp.riskLevel]}`}
        >
          {opp.spreadPercent.toFixed(1)}% spread
        </span>
        <span className="text-xs text-text-muted capitalize">
          {opp.category}
        </span>
        <span className="text-[10px] text-text-muted">·</span>
        <span className="text-xs text-text-muted">
          Vol {formatUsd(opp.volume)}
        </span>
        <span className="text-[10px] text-text-muted">·</span>
        <span className="text-xs text-text-muted">
          Liq {formatUsd(opp.liquidity)}
        </span>
        {opp.end_date && (
          <>
            <span className="text-[10px] text-text-muted">·</span>
            <span className="text-xs text-text-muted">
              Ends{" "}
              {new Date(opp.end_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          </>
        )}
      </div>

      {/* Question */}
      <h3 className="text-sm font-medium text-text-primary mb-4 leading-relaxed">
        {opp.question}
      </h3>

      {/* Price grid */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-ep-bg/50 rounded-lg p-2.5 text-center">
          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
            YES
          </div>
          <div className="text-sm font-semibold text-profit">
            {formatCents(opp.yes_price)}
          </div>
        </div>
        <div className="bg-ep-bg/50 rounded-lg p-2.5 text-center">
          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
            NO
          </div>
          <div className="text-sm font-semibold text-loss">
            {formatCents(opp.no_price)}
          </div>
        </div>
        <div className="bg-ep-bg/50 rounded-lg p-2.5 text-center">
          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
            Sum
          </div>
          <div className="text-sm font-semibold text-text-primary">
            {formatCents(opp.priceSum)}
          </div>
        </div>
        <div className="bg-ep-bg/50 rounded-lg p-2.5 text-center">
          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
            Profit/$100
          </div>
          <div
            className={`text-sm font-bold ${
              opp.profitPer100 > 0 ? "text-profit" : "text-loss"
            }`}
          >
            {opp.profitPer100 > 0 ? "+" : ""}${opp.profitPer100.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">
          Buy both sides to capture the spread
        </span>
        <div className="flex gap-2">
          <a
            href={`https://polymarket.com/event/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-profit/10 text-profit hover:bg-profit/20 transition"
          >
            Buy YES {formatCents(opp.yes_price)}
          </a>
          <a
            href={`https://polymarket.com/event/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-loss/10 text-loss hover:bg-loss/20 transition"
          >
            Buy NO {formatCents(opp.no_price)}
          </a>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Skeleton ── */

function ArbCardSkeleton() {
  return (
    <div className="ep-card p-5 animate-pulse">
      <div className="flex gap-2 mb-3">
        <div className="h-5 w-20 bg-ep-border rounded-full" />
        <div className="h-5 w-16 bg-ep-border rounded" />
        <div className="h-5 w-12 bg-ep-border rounded" />
      </div>
      <div className="h-4 w-3/4 bg-ep-border rounded mb-4" />
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 bg-ep-border/50 rounded-lg" />
        ))}
      </div>
      <div className="flex justify-between">
        <div className="h-4 w-48 bg-ep-border rounded" />
        <div className="flex gap-2">
          <div className="h-8 w-24 bg-ep-border rounded-lg" />
          <div className="h-8 w-24 bg-ep-border rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */

export default function ArbScannerPage() {
  const [opportunities, setOpportunities] = useState<ArbOpportunity[]>([]);
  const [stats, setStats] = useState<ArbStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("profit");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/arb-scanner");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setOpportunities(data.opportunities || []);
      setStats(data.stats || null);
      setScannedAt(data.scanned_at || null);
    } catch (err) {
      console.error("Arb scanner fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Client-side filter + sort
  const filtered = useMemo(() => {
    let result = [...opportunities];

    if (filter === "profitable") {
      result = result.filter((o) => o.profitPer100 > 0);
    } else if (filter === "high_liq") {
      result = result.filter((o) => o.liquidity >= 10_000);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "spread":
          return b.spreadPercent - a.spreadPercent;
        case "volume":
          return b.volume - a.volume;
        case "liquidity":
          return b.liquidity - a.liquidity;
        default:
          return b.profitPer100 - a.profitPer100;
      }
    });

    return result;
  }, [opportunities, filter, sortBy]);

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-display font-bold text-text-primary">
            Arb Scanner
          </h1>
          {scannedAt && (
            <span className="flex items-center gap-1.5 text-xs text-text-muted">
              <span className="live-dot" />
              Updated {timeAgo(scannedAt)}
            </span>
          )}
        </div>
        <p className="text-sm text-text-secondary">
          Find spread arbitrage opportunities across Polymarket. When YES + NO
          &lt; $1.00, buying both sides guarantees a profit.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="Opportunities"
              value={stats?.total_opportunities || 0}
            />
            <StatCard
              label="Avg Spread"
              value={stats?.avg_spread || 0}
              suffix="%"
              decimals={2}
            />
            <StatCard
              label="Best Profit"
              value={stats?.best_profit || 0}
              prefix="$"
              suffix="/100"
              decimals={2}
              colorize
            />
            <StatCard
              label="Markets Scanned"
              value={stats?.total_markets_scanned || 0}
            />
          </>
        )}
      </div>

      {/* Filters + Sort */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <FilterBar
          label="Filter"
          options={filterOptions}
          value={filter}
          onChange={setFilter}
        />
        <SortDropdown
          options={sortOptions}
          value={sortBy}
          onChange={setSortBy}
        />
      </div>

      {/* Fee disclaimer */}
      <div className="text-xs text-text-muted px-1">
        Profit estimates account for ~2% Polymarket fees. Actual execution prices
        may vary from displayed mid-market prices.
      </div>

      {/* Opportunity cards */}
      {loading ? (
        <div className="space-y-4">
          <ArbCardSkeleton />
          <ArbCardSkeleton />
          <ArbCardSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          className="ep-card p-10 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="text-3xl mb-3">⚖️</div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            No Arbitrage Opportunities
          </h3>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            Markets are efficiently priced right now. The scanner checks every 30
            seconds — opportunities appear when market prices temporarily
            diverge.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((opp) => (
              <ArbOpportunityCard key={opp.market_id} opp={opp} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
