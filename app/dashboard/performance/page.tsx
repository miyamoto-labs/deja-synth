"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  StatCard,
  StatCardSkeleton,
  ConvictionGauge,
} from "@/app/components/ui";

/* ── Helpers ────────────────────────────────────── */
function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/* ── Performance Page ──────────────────────────── */
export default function PerformancePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/performance");
      setData(await res.json());
    } catch (err) {
      console.error("Performance fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const hasResults = (data?.total_results || 0) > 0;
  const winRate = data?.win_rate || 0;
  const totalPnl = data?.total_pnl || 0;

  return (
    <div className="py-6 space-y-8">
      {/* ── Header ─────────────────────────────── */}
      <div className="flex items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold">Performance</h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            Track record and analytics for AI-curated picks
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-text-muted shrink-0">
          <span className="live-dot" />
          Auto-refreshing every 60s
        </div>
      </div>

      {/* ── Stats Row ──────────────────────────── */}
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
              label="Total Picks"
              value={data?.total_picks || 0}
              decimals={0}
            />
            <StatCard
              label="Win Rate"
              value={winRate}
              suffix="%"
              decimals={1}
              colorize={hasResults}
            />
            <StatCard
              label="Total PnL"
              value={totalPnl}
              prefix="$"
              decimals={2}
              colorize
            />
            <StatCard
              label="Avg Conviction"
              value={data?.avg_conviction || 0}
              decimals={0}
            />
          </>
        )}
      </div>

      {/* ── Win / Loss / Active breakdown ────── */}
      {!loading && (
        <div className="grid grid-cols-3 gap-4">
          <motion.div
            className="ep-card p-5 text-center"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="text-3xl font-mono font-bold text-profit">
              {data?.wins || 0}
            </div>
            <div className="text-xs text-text-muted uppercase tracking-wider mt-1">Wins</div>
          </motion.div>
          <motion.div
            className="ep-card p-5 text-center"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="text-3xl font-mono font-bold text-loss">
              {data?.losses || 0}
            </div>
            <div className="text-xs text-text-muted uppercase tracking-wider mt-1">Losses</div>
          </motion.div>
          <motion.div
            className="ep-card p-5 text-center"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="text-3xl font-mono font-bold text-accent">
              {data?.active_picks || 0}
            </div>
            <div className="text-xs text-text-muted uppercase tracking-wider mt-1">Active</div>
          </motion.div>
        </div>
      )}

      {/* ── Win Rate Visual ──────────────────── */}
      {!loading && hasResults && (
        <motion.div
          className="ep-card p-4 sm:p-6"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <h2 className="font-display text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Win Rate Breakdown
          </h2>
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <ConvictionGauge score={winRate} size="lg" />
            <div className="flex-1 w-full">
              {/* Win bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-profit font-medium">Wins</span>
                  <span className="font-mono text-text-primary">{data?.wins || 0}</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-profit/70"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${data?.total_results > 0 ? ((data?.wins || 0) / data.total_results) * 100 : 0}%`,
                    }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
              </div>
              {/* Loss bar */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-loss font-medium">Losses</span>
                  <span className="font-mono text-text-primary">{data?.losses || 0}</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-loss/70"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${data?.total_results > 0 ? ((data?.losses || 0) / data.total_results) * 100 : 0}%`,
                    }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Recent Results ────────────────────── */}
      <div>
        <h2 className="font-display text-lg font-semibold mb-4">Recent Results</h2>
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="ep-card p-4">
                <div className="skeleton h-4 w-3/4 mb-2 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
              </div>
            ))}
          </div>
        ) : data?.recent_results && data.recent_results.length > 0 ? (
          <div className="space-y-2">
            <AnimatePresence>
              {data.recent_results.map((r: any, i: number) => {
                const isWin = r.pnl_absolute > 0;
                return (
                  <motion.div
                    key={r.id}
                    className="ep-card p-4"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Win/Loss indicator */}
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                            isWin
                              ? "bg-profit/10 text-profit"
                              : "bg-loss/10 text-loss"
                          }`}
                        >
                          {isWin ? "W" : "L"}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-primary">
                            Pick #{r.pick_id?.slice(0, 8)}
                          </p>
                          <p className="text-xs text-text-muted">
                            {r.duration_hours?.toFixed(1)}h &middot; {r.exit_reason}
                            {r.resolved_at && (
                              <span className="ml-2">{timeAgo(r.resolved_at)}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <div className="text-xs text-text-muted">
                            {r.entry_price?.toFixed(0)}c &rarr;{" "}
                            {r.exit_price?.toFixed(0)}c
                          </div>
                        </div>
                        <div
                          className={`font-mono text-sm font-bold min-w-[60px] text-right ${
                            isWin ? "text-profit" : "text-loss"
                          }`}
                        >
                          {isWin ? "+" : ""}
                          {r.pnl_percent?.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="ep-card p-12 text-center">
            <div className="text-4xl mb-3">📊</div>
            <h3 className="font-display font-semibold text-text-primary">
              No closed picks yet
            </h3>
            <p className="text-sm text-text-muted mt-1">
              Performance tracking begins once picks are resolved. The engine
              monitors all active picks and records outcomes automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
