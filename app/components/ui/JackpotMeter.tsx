"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface JackpotMeterProps {
  sessionId?: string;
  walletAddress?: string;
  lastContribution?: number;
}

interface JackpotData {
  pool: {
    currentAmount: number;
    totalCollected: number;
    totalAwarded: number;
    totalContributions: number;
    lastContributionAt: string | null;
    weekStart: string;
  };
  recentWinners: {
    id: string;
    walletShort: string;
    amount: number;
    roi: number;
    awardedAt: string;
  }[];
  sessionContribution: number;
  weekLeader: {
    walletShort: string;
    roi: number;
  } | null;
}

function getJackpotTier(amount: number) {
  if (amount >= 50)
    return {
      label: "MEGA JACKPOT",
      color: "#F59E0B",
      secondaryColor: "#FF6B00",
      glowIntensity: 0.6,
      bgGradient:
        "linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(255,107,0,0.06) 100%)",
      icon: "\u{1F3C6}",
      pulseSpeed: 1.5,
    };
  if (amount >= 20)
    return {
      label: "HOT",
      color: "#00F0A0",
      secondaryColor: "#00FFB0",
      glowIntensity: 0.4,
      bgGradient:
        "linear-gradient(135deg, rgba(0,240,160,0.08) 0%, rgba(0,200,128,0.04) 100%)",
      icon: "\u{1F525}",
      pulseSpeed: 2,
    };
  if (amount >= 5)
    return {
      label: "WARM",
      color: "#00F0A0",
      secondaryColor: "#00C080",
      glowIntensity: 0.25,
      bgGradient:
        "linear-gradient(135deg, rgba(0,240,160,0.05) 0%, rgba(0,180,120,0.02) 100%)",
      icon: "\u2728",
      pulseSpeed: 2.5,
    };
  return {
    label: "BUILDING",
    color: "#8B92A8",
    secondaryColor: "#00F0A0",
    glowIntensity: 0.12,
    bgGradient:
      "linear-gradient(135deg, rgba(139,146,168,0.06) 0%, rgba(0,240,160,0.03) 100%)",
    icon: "\u26A1",
    pulseSpeed: 3,
  };
}

export function JackpotMeter({
  sessionId,
  walletAddress,
  lastContribution = 0,
}: JackpotMeterProps) {
  const [data, setData] = useState<JackpotData | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [displayAmount, setDisplayAmount] = useState(0);
  const prevAmountRef = useRef(0);

  const fetchJackpot = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (walletAddress) params.set("wallet", walletAddress);
      if (sessionId) params.set("sessionId", sessionId);
      const res = await fetch(`/api/bot/jackpot?${params}`);
      if (res.ok) setData(await res.json());
    } catch {
      // Silent
    }
  }, [sessionId, walletAddress]);

  // Initial fetch + poll every 15s
  useEffect(() => {
    fetchJackpot();
    const iv = setInterval(fetchJackpot, 15000);
    return () => clearInterval(iv);
  }, [fetchJackpot]);

  // Animated count-up when amount changes
  useEffect(() => {
    if (!data) return;
    const target = data.pool.currentAmount;
    const start = prevAmountRef.current;
    const diff = target - start;

    if (Math.abs(diff) < 0.001) {
      setDisplayAmount(target);
      return;
    }

    // Flash on increase
    if (diff > 0 && start > 0) {
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 1500);
    }

    const duration = 800;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayAmount(start + diff * eased);
      if (progress < 1) requestAnimationFrame(tick);
      else prevAmountRef.current = target;
    };
    requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.pool.currentAmount]);

  // Also flash on lastContribution prop change
  useEffect(() => {
    if (lastContribution > 0) {
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 1500);
    }
  }, [lastContribution]);

  if (!data) {
    return (
      <div className="rounded-2xl bg-ep-card border border-ep-border p-5 sm:p-6 animate-pulse">
        <div className="h-24 skeleton rounded-xl" />
      </div>
    );
  }

  const tier = getJackpotTier(displayAmount);
  const VISUAL_TARGET = 100;
  const fillPercent = Math.min((displayAmount / VISUAL_TARGET) * 100, 100);
  const wholeNumber = Math.floor(displayAmount).toString();
  const cents = (displayAmount % 1).toFixed(2).slice(2);

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl"
      animate={{
        boxShadow: [
          `0 0 ${20 * tier.glowIntensity}px ${tier.color}40, 0 0 ${60 * tier.glowIntensity}px ${tier.color}15`,
          `0 0 ${40 * tier.glowIntensity}px ${tier.color}60, 0 0 ${100 * tier.glowIntensity}px ${tier.color}25`,
          `0 0 ${20 * tier.glowIntensity}px ${tier.color}40, 0 0 ${60 * tier.glowIntensity}px ${tier.color}15`,
        ],
      }}
      transition={{
        duration: tier.pulseSpeed,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      style={{
        background: tier.bgGradient,
        border: `1px solid ${tier.color}40`,
      }}
    >
      {/* Flash overlay on contribution */}
      <AnimatePresence>
        {showFlash && (
          <>
            <motion.div
              initial={{ opacity: 0.7, scale: 1.02 }}
              animate={{ opacity: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5 }}
              className="absolute inset-0 z-10 pointer-events-none rounded-2xl"
              style={{
                background: `radial-gradient(ellipse at center, ${tier.color}30 0%, transparent 70%)`,
                border: `2px solid ${tier.color}60`,
              }}
            />
            {/* Floating "+1¢" text */}
            <motion.span
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 0, y: -30 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2 }}
              className="absolute top-3 right-5 z-20 text-sm font-mono font-bold pointer-events-none"
              style={{
                color: tier.color,
                textShadow: `0 0 8px ${tier.color}`,
              }}
            >
              +1¢
            </motion.span>
          </>
        )}
      </AnimatePresence>

      <div className="relative z-[2] p-5 sm:p-6 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-2.5 h-2.5 rounded-full animate-live-dot"
              style={{
                background: tier.color,
                boxShadow: `0 0 12px ${tier.color}60`,
              }}
            />
            <span className="text-lg">{tier.icon}</span>
            <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">
              Jackpot Pool
            </span>
            <motion.span
              className="text-[11px] font-extrabold px-2.5 py-1 rounded-md uppercase tracking-wide"
              style={{
                color: tier.color,
                background: `${tier.color}18`,
                border: `1px solid ${tier.color}40`,
                textShadow: `0 0 8px ${tier.color}40`,
              }}
              animate={
                tier.label === "MEGA JACKPOT"
                  ? {
                      scale: [1, 1.05, 1],
                      textShadow: [
                        `0 0 8px ${tier.color}40`,
                        `0 0 16px ${tier.color}80`,
                        `0 0 8px ${tier.color}40`,
                      ],
                    }
                  : {}
              }
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {tier.label}
            </motion.span>
          </div>
          {data.weekLeader && (
            <span className="text-[11px] text-text-muted hidden sm:inline">
              Leader:{" "}
              <span className="text-accent font-mono font-semibold">
                {data.weekLeader.walletShort}
              </span>{" "}
              ({data.weekLeader.roi > 0 ? "+" : ""}
              {data.weekLeader.roi}%)
            </span>
          )}
        </div>

        {/* Amount — hero number */}
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-1">
            <span
              className="text-2xl sm:text-3xl font-mono font-bold"
              style={{ color: `${tier.color}90` }}
            >
              $
            </span>
            <motion.span
              className="text-5xl sm:text-6xl font-mono font-black tracking-tight"
              style={{
                color: tier.color,
                textShadow: `0 0 20px ${tier.color}50, 0 0 40px ${tier.color}20`,
                filter: `drop-shadow(0 0 8px ${tier.color}30)`,
              }}
              key={Math.floor(displayAmount * 100)}
            >
              {wholeNumber}
            </motion.span>
            <span
              className="text-2xl sm:text-3xl font-mono font-bold self-start mt-2"
              style={{ color: `${tier.color}80` }}
            >
              .{cents}
            </span>
          </div>
          {data.sessionContribution > 0 && (
            <p className="text-xs text-text-muted pb-2">
              You:{" "}
              <span className="text-accent font-mono font-semibold">
                ${data.sessionContribution.toFixed(3)}
              </span>
            </p>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="relative h-4 sm:h-5 rounded-full overflow-hidden bg-ep-border/60">
            {/* Fill */}
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                background: `linear-gradient(90deg, ${tier.color}40, ${tier.color}90, ${tier.color})`,
                boxShadow: `0 0 16px ${tier.color}50, inset 0 1px 0 rgba(255,255,255,0.15)`,
              }}
              initial={{ width: 0 }}
              animate={{ width: `${fillPercent}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />

            {/* Shimmer overlay */}
            <div
              className="absolute inset-0 animate-shimmer"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
                backgroundSize: "200% 100%",
              }}
            />

            {/* Glowing edge particle at fill tip */}
            {fillPercent > 0 && (
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                style={{
                  background: tier.color,
                  boxShadow: `0 0 12px ${tier.color}, 0 0 24px ${tier.color}80`,
                }}
                animate={{
                  left: `calc(${fillPercent}% - 6px)`,
                  scale: [1, 1.3, 1],
                  opacity: [0.8, 1, 0.8],
                }}
                transition={{
                  left: { duration: 1, ease: "easeOut" },
                  scale: { duration: 1.5, repeat: Infinity },
                  opacity: { duration: 1.5, repeat: Infinity },
                }}
              />
            )}

            {/* Tier threshold markers */}
            {[5, 20, 50].map((threshold) => (
              <div
                key={threshold}
                className="absolute top-0 bottom-0 w-px"
                style={{
                  left: `${(threshold / VISUAL_TARGET) * 100}%`,
                  background: "rgba(255,255,255,0.15)",
                }}
              />
            ))}
          </div>

          {/* Scale labels */}
          <div className="relative flex justify-between text-[9px] text-text-muted font-mono px-0.5">
            <span>$0</span>
            <span className="absolute" style={{ left: "5%" }}>$5</span>
            <span className="absolute" style={{ left: "20%" }}>$20</span>
            <span className="absolute" style={{ left: "50%" }}>$50</span>
            <span className="ml-auto">$100</span>
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] text-text-muted">
            <span className="font-mono font-semibold text-text-secondary">
              {data.pool.totalContributions.toLocaleString()}
            </span>{" "}
            bets pooled
          </p>
          {data.recentWinners.length > 0 ? (
            <p className="text-[11px] text-text-muted">
              Last:{" "}
              <span className="text-accent font-mono">
                {data.recentWinners[0].walletShort}
              </span>{" "}
              won{" "}
              <span className="text-profit font-mono font-semibold">
                ${data.recentWinners[0].amount.toFixed(2)}
              </span>
            </p>
          ) : (
            <p className="text-[11px] text-text-muted italic">
              Awarded weekly to top ROI player
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
