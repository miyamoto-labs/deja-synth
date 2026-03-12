"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useUserStore } from "@/app/lib/stores/user-store";

/* ── Types ──────────────────────────────────────── */
interface LeaderboardEntry {
  rank: number;
  id: string;
  wallet: string;
  walletShort: string;
  mode: "auto" | "arcade";
  market: string;
  bankroll: number;
  pnl: number;
  roi: number;
  winRate: number;
  wins: number;
  losses: number;
  trades: number;
  startedAt: string;
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
  totalSessions: number;
  avgRoi: number;
  bestRoi: number;
  currentUserBest: (LeaderboardEntry & { totalSessions: number }) | null;
}

type Period = "all" | "week" | "today";
type ModeFilter = "all" | "auto" | "arcade";
type SortBy = "roi" | "winrate" | "pnl";

const MEDAL: Record<number, string> = { 1: "\u{1F947}", 2: "\u{1F948}", 3: "\u{1F949}" };

/* ── Page ───────────────────────────────────────── */
export default function BotLeaderboardPage() {
  const { walletAddress } = useUserStore();
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("all");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("roi");

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        period,
        mode: modeFilter,
        sort: sortBy,
        limit: "50",
      });
      if (walletAddress) params.set("wallet", walletAddress);
      const res = await fetch(`/api/bot/leaderboard?${params}`);
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error("Leaderboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, period, modeFilter, sortBy]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 60s
  useEffect(() => {
    const iv = setInterval(fetchData, 60000);
    return () => clearInterval(iv);
  }, [fetchData]);

  /* ── Loading ─────────────────────────────────── */
  if (loading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-text-muted">
        <svg className="mr-2 h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading leaderboard...
      </div>
    );
  }

  const leaders = data?.leaderboard || [];
  const userBest = data?.currentUserBest;

  return (
    <div className="space-y-6 py-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-text-primary">Bot Arena Leaderboard</h1>
          <p className="text-xs text-text-muted mt-1">Top performing bot sessions ranked by performance</p>
        </div>
        <a
          href="/dashboard/bot"
          className="px-3 py-1.5 rounded-lg bg-ep-surface text-text-secondary text-xs font-medium border border-ep-border hover:border-ep-border-bright transition"
        >
          Back to Bot
        </a>
      </div>

      {/* ── Your Best Session ── */}
      {userBest && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="ep-card p-5 border border-accent/20 bg-accent/[0.02]"
        >
          <p className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-3">Your Best Session</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div>
              <p className="text-[10px] text-text-muted">Rank</p>
              <p className="text-lg font-mono font-bold text-accent">#{userBest.rank}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-muted">ROI</p>
              <p className={`text-lg font-mono font-bold ${userBest.roi >= 0 ? "text-profit" : "text-loss"}`}>
                {userBest.roi >= 0 ? "+" : ""}{userBest.roi.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-[10px] text-text-muted">Win Rate</p>
              <p className="text-lg font-mono font-bold text-text-primary">{userBest.winRate.toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-[10px] text-text-muted">P&L</p>
              <p className={`text-lg font-mono font-bold ${userBest.pnl >= 0 ? "text-profit" : "text-loss"}`}>
                {userBest.pnl >= 0 ? "+" : ""}${userBest.pnl.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-text-muted">Sessions</p>
              <p className="text-lg font-mono font-bold text-text-primary">{userBest.totalSessions}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Filter Bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Period */}
        <div className="flex gap-1 p-0.5 bg-ep-surface rounded-lg border border-ep-border">
          {(["all", "week", "today"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                period === p ? "bg-accent text-ep-bg" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {p === "all" ? "All Time" : p === "week" ? "This Week" : "Today"}
            </button>
          ))}
        </div>

        {/* Mode */}
        <div className="flex gap-1 p-0.5 bg-ep-surface rounded-lg border border-ep-border">
          {(["all", "auto", "arcade"] as ModeFilter[]).map((m) => (
            <button
              key={m}
              onClick={() => setModeFilter(m)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                modeFilter === m ? "bg-accent text-ep-bg" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {m === "all" ? "All" : m === "auto" ? "Auto" : "Arcade"}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex gap-1 p-0.5 bg-ep-surface rounded-lg border border-ep-border">
          {([
            { id: "roi" as SortBy, label: "ROI%" },
            { id: "winrate" as SortBy, label: "Win Rate" },
            { id: "pnl" as SortBy, label: "P&L" },
          ]).map((s) => (
            <button
              key={s.id}
              onClick={() => setSortBy(s.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                sortBy === s.id ? "bg-accent text-ep-bg" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Aggregate Stats ── */}
      {data && (
        <div className="grid grid-cols-3 gap-3">
          <div className="ep-card p-4 text-center">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Total Sessions</p>
            <p className="text-xl font-mono font-bold text-text-primary mt-1">{data.totalSessions}</p>
          </div>
          <div className="ep-card p-4 text-center">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Avg ROI</p>
            <p className={`text-xl font-mono font-bold mt-1 ${data.avgRoi >= 0 ? "text-profit" : "text-loss"}`}>
              {data.avgRoi >= 0 ? "+" : ""}{data.avgRoi}%
            </p>
          </div>
          <div className="ep-card p-4 text-center">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Best ROI</p>
            <p className={`text-xl font-mono font-bold mt-1 ${data.bestRoi >= 0 ? "text-profit" : "text-loss"}`}>
              {data.bestRoi >= 0 ? "+" : ""}{data.bestRoi}%
            </p>
          </div>
        </div>
      )}

      {/* ── Leaderboard Table ── */}
      <div className="ep-card overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[3rem_1fr_4rem_4rem_4.5rem_4.5rem_3.5rem] gap-2 px-4 py-3 border-b border-ep-border bg-ep-surface/50 text-[10px] text-text-muted uppercase tracking-wider font-semibold">
          <span>#</span>
          <span>User</span>
          <span className="text-right">Mode</span>
          <span className="text-right">ROI%</span>
          <span className="text-right">Win Rate</span>
          <span className="text-right">P&L</span>
          <span className="text-right">Trades</span>
        </div>

        {leaders.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-text-muted">No sessions yet. Be the first!</p>
          </div>
        ) : (
          <div className="divide-y divide-ep-border">
            {leaders.map((entry) => {
              const isUser = walletAddress && entry.wallet === walletAddress.toLowerCase();
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`grid grid-cols-[3rem_1fr_4rem_4rem_4.5rem_4.5rem_3.5rem] gap-2 px-4 py-3 items-center text-xs transition ${
                    isUser ? "bg-accent/[0.04] border-l-2 border-l-accent" : ""
                  } ${entry.rank <= 3 ? "bg-accent/[0.02]" : ""}`}
                >
                  {/* Rank */}
                  <span className="font-mono font-bold text-text-primary">
                    {MEDAL[entry.rank] || `#${entry.rank}`}
                  </span>

                  {/* User */}
                  <span className={`font-mono truncate ${isUser ? "text-accent font-semibold" : "text-text-secondary"}`}>
                    {isUser ? "You" : entry.walletShort}
                  </span>

                  {/* Mode badge */}
                  <span className="text-right">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      entry.mode === "arcade"
                        ? "bg-[#F59E0B]/10 text-[#F59E0B]"
                        : "bg-accent/10 text-accent"
                    }`}>
                      {entry.mode === "arcade" ? "🎮" : "🤖"}
                      {entry.mode === "arcade" ? "Arc" : "Auto"}
                    </span>
                  </span>

                  {/* ROI% */}
                  <span className={`text-right font-mono font-bold ${entry.roi >= 0 ? "text-profit" : "text-loss"}`}>
                    {entry.roi >= 0 ? "+" : ""}{entry.roi.toFixed(1)}%
                  </span>

                  {/* Win Rate */}
                  <span className="text-right font-mono text-text-primary">
                    {entry.winRate.toFixed(0)}%
                  </span>

                  {/* P&L */}
                  <span className={`text-right font-mono ${entry.pnl >= 0 ? "text-profit" : "text-loss"}`}>
                    {entry.pnl >= 0 ? "+" : ""}${entry.pnl.toFixed(2)}
                  </span>

                  {/* Trades */}
                  <span className="text-right font-mono text-text-muted">
                    {entry.trades}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
