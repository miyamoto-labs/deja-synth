"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useUserStore } from "@/app/lib/stores/user-store";
import { PointsTierBadge } from "@/app/components/ui";

/* ── Types ──────────────────────────────────────── */
interface LeaderboardUser {
  rank: number;
  wallet: string;
  walletFull: string;
  totalPoints: number;
  tier: string;
  referralCount: number;
  tradeCount: number;
  isCurrentUser: boolean;
}

interface LeaderboardData {
  leaderboard: LeaderboardUser[];
  totalUsers: number;
  avgPoints: number;
  topScore: number;
  currentUserRank: number | null;
  currentUserStats: LeaderboardUser | null;
}

const MEDAL: Record<number, string> = { 1: "\u{1F947}", 2: "\u{1F948}", 3: "\u{1F949}" };

/* ── Page ───────────────────────────────────────── */
export default function LeaderboardPage() {
  const { walletAddress, isConnected } = useUserStore();
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (walletAddress) params.set("wallet", walletAddress);
      const res = await fetch(`/api/points/leaderboard?${params}`);
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error("Leaderboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  /* ── Loading ─────────────────────────────────── */
  if (loading) {
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
  const userStats = data?.currentUserStats;

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────── */}
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-bold">Leaderboard</h1>
        <p className="text-xs sm:text-sm text-text-muted mt-1">
          Earn points. Climb the ranks. Future airdrop eligibility based on points.
        </p>
      </div>

      {/* ── Your Position (if connected) ────── */}
      {isConnected && userStats && (
        <motion.div
          className="ep-card p-5 sm:p-6 border-accent/20"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Your Position</p>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-mono font-bold text-accent">
                  #{data?.currentUserRank || "—"}
                </span>
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {userStats.totalPoints.toLocaleString()} points
                  </p>
                  <PointsTierBadge tier={userStats.tier} />
                </div>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-6 text-center">
              <div>
                <p className="text-lg font-mono font-bold text-text-primary">{userStats.referralCount}</p>
                <p className="text-[10px] text-text-muted uppercase">Referrals</p>
              </div>
              <div>
                <p className="text-lg font-mono font-bold text-text-primary">{userStats.tradeCount}</p>
                <p className="text-[10px] text-text-muted uppercase">Trades</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Stats Row ───────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Users", value: data?.totalUsers || 0 },
          { label: "Avg Points", value: data?.avgPoints || 0 },
          { label: "Top Score", value: data?.topScore || 0 },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            className="ep-card p-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
              {stat.label}
            </span>
            <div className="mt-1 text-lg sm:text-xl font-mono font-bold text-text-primary">
              {stat.value.toLocaleString()}
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Points Breakdown ────────────────── */}
      <motion.div
        className="ep-card p-5"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
          How to Earn Points
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { action: "Sign Up", pts: 100, emoji: "\u{1F44B}" },
            { action: "Refer Friend", pts: 250, emoji: "\u{1F91D}" },
            { action: "Trade", pts: 50, emoji: "\u{1F4B0}" },
            { action: "Copy Pick", pts: 25, emoji: "\u{1F3AF}" },
            { action: "Daily Login", pts: 10, emoji: "\u{2615}" },
          ].map((item) => (
            <div key={item.action} className="text-center rounded-lg bg-ep-surface border border-ep-border p-3">
              <span className="text-lg">{item.emoji}</span>
              <p className="text-xs text-text-secondary mt-1">{item.action}</p>
              <p className="text-sm font-mono font-bold text-accent mt-0.5">+{item.pts}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Leaderboard Table ───────────────── */}
      {leaders.length > 0 ? (
        <div className="ep-card overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-ep-border text-[10px] font-semibold text-text-muted uppercase tracking-wider">
            <div className="col-span-1">#</div>
            <div className="col-span-4">User</div>
            <div className="col-span-2 text-right">Points</div>
            <div className="col-span-2 text-center">Tier</div>
            <div className="col-span-1 text-right hidden sm:block">Refs</div>
            <div className="col-span-2 text-right hidden sm:block">Trades</div>
          </div>

          {/* Rows */}
          {leaders.map((user, i) => (
            <motion.div
              key={user.walletFull}
              className={`grid grid-cols-12 gap-2 px-4 py-3 items-center border-b border-ep-border/50 transition hover:bg-ep-card-hover ${
                user.isCurrentUser ? "bg-accent/5 border-l-2 border-l-accent" : ""
              } ${user.rank <= 3 ? "bg-white/[0.02]" : ""}`}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              {/* Rank */}
              <div className="col-span-1 font-mono text-sm font-bold text-text-muted">
                {MEDAL[user.rank] || user.rank}
              </div>

              {/* Wallet */}
              <div className="col-span-4">
                <span className="font-mono text-sm text-text-primary">
                  {user.wallet}
                </span>
                {user.isCurrentUser && (
                  <span className="ml-2 text-[10px] text-accent font-semibold">YOU</span>
                )}
              </div>

              {/* Points */}
              <div className="col-span-2 text-right font-mono text-sm font-bold text-text-primary">
                {user.totalPoints.toLocaleString()}
              </div>

              {/* Tier */}
              <div className="col-span-2 text-center">
                <PointsTierBadge tier={user.tier} />
              </div>

              {/* Referrals */}
              <div className="col-span-1 text-right font-mono text-xs text-text-muted hidden sm:block">
                {user.referralCount}
              </div>

              {/* Trades */}
              <div className="col-span-2 text-right font-mono text-xs text-text-muted hidden sm:block">
                {user.tradeCount}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="ep-card p-12 text-center">
          <div className="text-4xl mb-3">{"\u{1F3C6}"}</div>
          <p className="text-text-secondary text-sm font-medium">No users on the leaderboard yet</p>
          <p className="text-text-muted text-xs mt-1">
            Connect your wallet and start earning points to claim your spot!
          </p>
        </div>
      )}

      {/* ── Tier Legend ──────────────────────── */}
      <motion.div
        className="ep-card p-5"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Tier Thresholds</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { tier: "bronze", range: "0 – 499", emoji: "\u{1F949}" },
            { tier: "silver", range: "500 – 1,999", emoji: "\u{1F948}" },
            { tier: "gold", range: "2,000 – 9,999", emoji: "\u{1F3C6}" },
            { tier: "diamond", range: "10,000+", emoji: "\u{1F48E}" },
          ].map((t) => (
            <div key={t.tier} className="flex items-center gap-2 rounded-lg bg-ep-surface border border-ep-border p-3">
              <span className="text-lg">{t.emoji}</span>
              <div>
                <p className="text-xs font-semibold text-text-primary capitalize">{t.tier}</p>
                <p className="text-[10px] text-text-muted">{t.range} pts</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
