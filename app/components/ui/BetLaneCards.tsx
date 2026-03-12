"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface ActiveBetSlot {
  id: string;
  side: "UP" | "DOWN";
  entryPrice: number;
  amount: number;
  shares: number;
  market: string;
  slug: string;
  marketEndTime: number;
  status: "live" | "resolving" | "resolved";
  result?: { outcome: "won" | "lost" | "push"; pnl: number };
}

/* ── Individual Bet Lane Card ── */
function BetCard({ bet }: { bet: ActiveBetSlot }) {
  const [countdown, setCountdown] = useState("");

  // Parse window time from slug: e.g. "btc-updown-5m-1740000000"
  const windowStartTs = parseInt(bet.slug.split("-").pop() || "0") * 1000;
  const windowEndTs = windowStartTs + 5 * 60 * 1000;
  const startTime = new Date(windowStartTs);
  const endTime = new Date(windowEndTs);
  const fmt = (d: Date) =>
    `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}`;

  useEffect(() => {
    if (bet.status !== "live") return;
    const tick = () => {
      const remaining = Math.max(0, bet.marketEndTime - Date.now());
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${mins}:${secs.toString().padStart(2, "0")}`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [bet.marketEndTime, bet.status]);

  // Resolved state — show result flash
  if (bet.status === "resolved" && bet.result) {
    const isWin = bet.result.outcome === "won";
    return (
      <motion.div
        initial={{ opacity: 1, scale: 1 }}
        animate={{ opacity: 0, scale: 0.9 }}
        transition={{ delay: 2, duration: 0.5 }}
        className={`flex-shrink-0 w-[140px] rounded-xl border p-3 text-center ${
          isWin
            ? "border-profit/50 bg-profit/[0.08]"
            : "border-loss/50 bg-loss/[0.08]"
        }`}
      >
        <p className={`text-lg font-bold ${isWin ? "text-profit" : "text-loss"}`}>
          {isWin ? "WIN!" : "LOSS"}
        </p>
        <p className={`text-xs font-mono ${bet.result.pnl >= 0 ? "text-profit" : "text-loss"}`}>
          {bet.result.pnl >= 0 ? "+" : ""}{bet.result.pnl.toFixed(2)}
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30, scale: 0.9 }}
      className={`flex-shrink-0 w-[140px] rounded-xl border p-3 space-y-1.5 ${
        bet.side === "UP"
          ? "border-profit/30 bg-profit/[0.04]"
          : "border-loss/30 bg-loss/[0.04]"
      }`}
    >
      {/* Side badge + countdown */}
      <div className="flex items-center justify-between">
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
            bet.side === "UP"
              ? "bg-profit/15 text-profit"
              : "bg-loss/15 text-loss"
          }`}
        >
          {bet.side} ${bet.amount}
        </span>
        {bet.status === "live" && (
          <span className="text-xs font-mono text-accent font-semibold">
            {countdown}
          </span>
        )}
        {bet.status === "resolving" && (
          <div className="w-3.5 h-3.5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        )}
      </div>

      {/* Entry price */}
      <p className="text-[10px] text-text-muted">
        @ {(bet.entryPrice * 100).toFixed(0)}c
      </p>

      {/* Window time range */}
      <p className="text-[10px] text-text-muted font-mono">
        {fmt(startTime)}–{fmt(endTime)} UTC
      </p>

      {/* Status dot */}
      <div className="flex items-center gap-1.5">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            bet.status === "live"
              ? "bg-profit animate-pulse"
              : "bg-accent animate-spin"
          }`}
        />
        <span className="text-[9px] text-text-muted uppercase tracking-wider">
          {bet.status === "live" ? "LIVE" : "Checking..."}
        </span>
      </div>
    </motion.div>
  );
}

/* ── BetLaneCards Container ── */
export function BetLaneCards({ activeBets }: { activeBets: ActiveBetSlot[] }) {
  if (activeBets.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">
          Active Bets ({activeBets.length}/5)
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <AnimatePresence mode="popLayout">
          {activeBets.map((bet) => (
            <BetCard key={bet.id} bet={bet} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
