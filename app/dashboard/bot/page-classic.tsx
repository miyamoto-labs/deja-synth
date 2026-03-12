"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore } from "@/app/lib/stores/user-store";
import { BotRaceView } from "@/app/components/ui/BotRaceView";
import { ArcadeTour } from "@/app/components/ui/ArcadeTour";
import { ArcadeChartCell } from "@/app/components/ui/ArcadeChartCell";
import { ArcadePositions } from "@/app/components/ui/ArcadePositions";
import { ArcadeOrderBook } from "@/app/components/ui/ArcadeOrderBook";
import { ArcadeTradeFeed } from "@/app/components/ui/ArcadeTradeFeed";
import { ArcadeCountdown } from "@/app/components/ui/ArcadeCountdown";
import { LiveMarketPreview } from "@/app/components/ui/LiveMarketPreview";
import { SynthdataPrediction } from "@/app/components/ui/SynthdataPrediction";
import { SnakeGameOverlay } from "@/app/components/ui/snake-game/SnakeGameOverlay";
import type { FrameData } from "@/app/components/ui/snake-game/types";
import type { GameRoundSummary } from "@/app/components/ui/snake-game/types";
import { useTradeExecution } from "@/app/lib/hooks/useTradeExecution";
import { useBinancePrice } from "@/app/lib/hooks/useBinancePrice";
import { formatWindowTimeRange, getCurrentWindowTimestamp, getNextWindowTimestamp } from "@/app/lib/utils/market-windows";

/* ── Types ──────────────────────────────────────── */
type BotStatus = "idle" | "starting" | "running" | "stopped";

interface ArcadeSession {
  id: string;
  status: BotStatus | string;
  market: string;
  bankroll: number;
  currentBalance: number;
  totalPnl: number;
  trades: number;
  wins: number;
  losses: number;
  betsRemaining: number;
}

interface ArcadeTrade {
  id: string;
  market: string;
  side: "UP" | "DOWN";
  amount: number;
  entryPrice: number;
  outcome: "won" | "lost" | "pending";
  pnl: number;
  createdAt: string;
  shares?: number;
  resolvedAt?: string | null;
}

interface ActiveBet {
  id: string;
  side: "UP" | "DOWN";
  entryPrice: number;
  amount: number;
  shares: number;
  market: string;
  slug: string;
  marketEndTime: number;
  status: "live" | "resolving" | "resolved";
  tokenId?: string;
  result?: { outcome: "won" | "lost" | "push"; pnl: number };
}

interface ActiveMarket {
  slug: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  endTime: number;
  conditionId: string;
  resolved: boolean;
  tokenId?: string;
}

/* ── Constants ──────────────────────────────────── */
const MARKETS = ["BTC-5m", "ETH-5m"] as const;
type ArcadeMarket = (typeof MARKETS)[number];
const MAX_CONCURRENT_BETS = 5;
const BANKROLL_OPTIONS = [10, 25, 50, 100];
const BET_AMOUNT_OPTIONS = [1, 2, 5, 10];

/* ── Bet Slots Preview (animated demo) ─────────── */
function BetSlotsPreview() {
  const [demoStep, setDemoStep] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => {
      setDemoStep((s) => (s + 1) % 4);
    }, 2200);
    return () => clearInterval(iv);
  }, []);

  const demoSlots: Array<{ side: "UP" | "DOWN"; label: string; active: boolean }> = [
    { side: "UP", label: "BTC", active: demoStep >= 1 },
    { side: "DOWN", label: "ETH", active: demoStep >= 2 },
    { side: "UP", label: "BTC", active: demoStep >= 3 },
    { side: "UP", label: "ETH", active: false },
    { side: "DOWN", label: "BTC", active: false },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {demoSlots.map((slot, i) => (
        <motion.div
          key={i}
          className={`flex-shrink-0 w-[110px] sm:w-[130px] h-[72px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all duration-500 ${
            slot.active
              ? slot.side === "UP"
                ? "border-profit/40 bg-profit/[0.06]"
                : "border-loss/40 bg-loss/[0.06]"
              : "border-ep-border/40 bg-ep-surface/30"
          }`}
          animate={{
            opacity: slot.active ? 1 : 0.5,
            scale: slot.active ? 1 : 0.97,
          }}
          transition={{ duration: 0.4 }}
        >
          {slot.active ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <span
                className={`text-xs font-bold ${
                  slot.side === "UP" ? "text-profit" : "text-loss"
                }`}
              >
                {slot.label} {slot.side} ▸
              </span>
              <p className="text-[9px] text-text-muted font-mono mt-0.5">LIVE</p>
            </motion.div>
          ) : (
            <>
              <span className="text-text-muted/30 text-lg font-light">+</span>
              <span className="text-[9px] text-text-muted/40 font-medium">
                Slot {i + 1}
              </span>
            </>
          )}
        </motion.div>
      ))}
    </div>
  );
}

/* ── Main Page ──────────────────────────────────── */
export default function ArcadePage() {
  const { walletAddress, hasCredentials } = useUserStore();
  const { executeTrade } = useTradeExecution();

  // Shared price feeds (2 WebSocket connections total)
  const btcPrice = useBinancePrice("btcusdt");
  const ethPrice = useBinancePrice("ethusdt");

  // Setup state
  const [bankroll, setBankroll] = useState(0);
  const [betAmount, setBetAmount] = useState(1);
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);

  const totalBets = bankroll > 0 && betAmount > 0 ? Math.floor(bankroll / betAmount) : 0;

  // Session state
  const [botStatus, setBotStatus] = useState<BotStatus>("idle");
  const [session, setSession] = useState<ArcadeSession | null>(null);
  const [trades, setTrades] = useState<ArcadeTrade[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Multi-market state
  const [activeBets, setActiveBets] = useState<ActiveBet[]>([]);
  const [clicking, setClicking] = useState(false);
  const [marketInfoMap, setMarketInfoMap] = useState<Record<string, ActiveMarket>>({});
  const [sellingId, setSellingId] = useState<string | null>(null);
  const resolveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const resolveRetryRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const marketPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [frameData, setFrameData] = useState<FrameData | null>(null);
  const [polyBalance, setPolyBalance] = useState<number | null>(null);
  const [windowTick, setWindowTick] = useState(0);

  const isRunning = botStatus !== "idle";
  const canPlaceBet = activeBets.length < MAX_CONCURRENT_BETS
    && (session?.betsRemaining ?? 0) > 0
    && !clicking;

  // Window time labels (refresh every 30 seconds)
  useEffect(() => {
    const iv = setInterval(() => setWindowTick((t) => t + 1), 30000);
    return () => clearInterval(iv);
  }, []);

  const currentWindowTs = getCurrentWindowTimestamp();
  const nextWindowTs = getNextWindowTimestamp();
  const currentTimeRange = formatWindowTimeRange(currentWindowTs);
  const nextTimeRange = formatWindowTimeRange(nextWindowTs);

  // Build activeBet per chart cell
  const getBetForCell = (market: ArcadeMarket, windowLabel: string) => {
    return activeBets.find(
      (b) => b.market === market && b.status !== "resolved"
    ) || null;
  };

  // Primary bet for snake game
  const primaryBet = activeBets.find((b) => b.status === "live") || null;
  const activeBetForSnake = primaryBet
    ? {
        side: primaryBet.side,
        entryPrice: primaryBet.entryPrice,
        amount: primaryBet.amount,
        shares: primaryBet.shares,
        market: primaryBet.market,
        marketEndTime: primaryBet.marketEndTime,
      }
    : null;

  // Current prices map for positions panel
  const currentPrices: Record<string, number> = {};
  for (const market of MARKETS) {
    const info = marketInfoMap[market];
    if (info) {
      // Use the yes price as a proxy for UP positions
      currentPrices[market] = info.yesPrice;
    }
  }

  /* ── Fetch Polymarket balance ── */
  useEffect(() => {
    if (!walletAddress || !hasCredentials) {
      setPolyBalance(null);
      return;
    }
    let cancelled = false;
    const fetchBalance = async () => {
      try {
        const res = await fetch(`/api/wallet/balance?wallet=${walletAddress}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setPolyBalance(data.balance ?? 0);
        }
      } catch { /* silent */ }
    };
    fetchBalance();
    return () => { cancelled = true; };
  }, [walletAddress, hasCredentials]);

  /* ── Fetch active market info (both BTC + ETH) ── */
  const fetchMarketInfo = useCallback(async () => {
    try {
      const [btcRes, ethRes] = await Promise.all([
        fetch(`/api/bot/active-market?asset=btc&interval=5`),
        fetch(`/api/bot/active-market?asset=eth&interval=5`),
      ]);

      const newMap: Record<string, ActiveMarket> = {};
      if (btcRes.ok) {
        const data = await btcRes.json();
        newMap["BTC-5m"] = data;
      }
      if (ethRes.ok) {
        const data = await ethRes.json();
        newMap["ETH-5m"] = data;
      }
      setMarketInfoMap(newMap);
    } catch {
      // Silent — odds just won't update
    }
  }, []);

  /* ── Start Arcade Session ── */
  const handleStart = async () => {
    if (!walletAddress || !disclaimerChecked) return;
    setStarting(true);
    setError(null);

    try {
      const res = await fetch("/api/bot/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          plan: "arcade",
          market: "MULTI",
          bankroll: bankroll,
          betAmount: betAmount,
          settings: {},
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to start session");
        setStarting(false);
        return;
      }

      setBotStatus("running");
      setSession({
        id: data.sessionId,
        status: "running",
        market: "MULTI",
        bankroll: bankroll,
        currentBalance: bankroll,
        totalPnl: 0,
        trades: 0,
        wins: 0,
        losses: 0,
        betsRemaining: data.betsRemaining || 0,
      });
      setTrades([]);
      setActiveBets([]);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setStarting(false);
    }
  };

  /* ── Stop Session ── */
  const handleStop = async () => {
    if (!walletAddress || !session?.id) return;
    setError(null);

    // Clear all timers
    resolveTimersRef.current.forEach((t) => clearTimeout(t));
    resolveTimersRef.current.clear();
    resolveRetryRefs.current.forEach((t) => clearInterval(t));
    resolveRetryRefs.current.clear();
    if (marketPollRef.current) clearInterval(marketPollRef.current);

    try {
      const res = await fetch("/api/bot/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          sessionId: session.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to stop session");
        return;
      }

      setBotStatus("stopped");
      setActiveBets([]);
      setSession((s) =>
        s
          ? {
              ...s,
              status: "stopped",
              currentBalance: data.finalBalance,
              totalPnl: data.totalPnl,
              trades: data.totalTrades,
              wins: data.wins,
              losses: data.losses,
            }
          : s
      );

      setTimeout(() => {
        setBotStatus("idle");
        setSession(null);
        setTrades([]);
        setDisclaimerChecked(false);
      }, 3000);
    } catch {
      setError("Network error stopping session. Please try again.");
    }
  };

  /* ── Click Bet (multi-market) ── */
  const handleClickBet = async (side: "UP" | "DOWN", market: ArcadeMarket) => {
    if (!walletAddress || !session?.id || !canPlaceBet) return;
    setClicking(true);
    setError(null);

    try {
      // 1. Build excludeSlugs from current active bets for this market
      const excludeSlugs = activeBets
        .filter((b) => b.market === market)
        .map((b) => b.slug)
        .join(",");

      // 2. Look up next available market window
      const marketRes = await fetch(
        `/api/arcade/market?market=${market}&side=${side}&excludeSlugs=${encodeURIComponent(excludeSlugs)}`
      );
      const marketData = await marketRes.json();

      if (!marketRes.ok) {
        setError(marketData.error || "No active market found");
        setClicking(false);
        return;
      }

      // 3. Sign + submit order via Privy wallet
      const tradeResult = await executeTrade({
        tokenId: marketData.tokenId,
        side: "BUY",
        amount: betAmount,
        price: marketData.price,
        direction: side === "UP" ? "YES" : "NO",
        source: "arcade",
        sourceId: session.id,
      });

      if (!tradeResult.success) {
        setError(tradeResult.error || "Order failed");
        setClicking(false);
        return;
      }

      // 4. Record the trade
      const recordRes = await fetch("/api/arcade/record-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          sessionId: session.id,
          side,
          market,
          orderId: tradeResult.orderID || `order-${Date.now()}`,
          tokenId: marketData.tokenId,
          slug: marketData.slug,
          entryPrice: marketData.price,
          marketEndTime: marketData.marketEndTime,
          betAmount: betAmount,
        }),
      });

      const recordData = await recordRes.json();

      if (!recordRes.ok) {
        console.error("Record-trade error:", recordData.error);
      }

      // 5. Append new bet to activeBets
      const entryPrice = marketData.price || 0.5;
      const newBet: ActiveBet = {
        id: recordData.tradeId || `temp-${Date.now()}`,
        side,
        entryPrice,
        amount: betAmount,
        shares: entryPrice > 0 ? betAmount / entryPrice : 0,
        market,
        slug: marketData.slug,
        marketEndTime: marketData.marketEndTime || (Date.now() + 5 * 60 * 1000),
        status: "live",
        tokenId: marketData.tokenId,
      };

      setActiveBets((prev) => [...prev, newBet]);

      // 6. Update session stats
      setSession((s) =>
        s
          ? {
              ...s,
              betsRemaining:
                recordData.betsRemaining ?? (s.betsRemaining ? s.betsRemaining - 1 : 0),
              currentBalance: s.currentBalance - betAmount,
              trades: s.trades + 1,
            }
          : s
      );

      // 7. Schedule independent resolution timer
      const msUntilEnd = (marketData.marketEndTime || (Date.now() + 5 * 60 * 1000)) - Date.now();
      const timer = setTimeout(() => {
        resolveArcadeBet(newBet.id);
      }, Math.max(msUntilEnd + 2000, 5000));
      resolveTimersRef.current.set(newBet.id, timer);
    } catch {
      setError("Network error placing bet.");
    } finally {
      setClicking(false);
    }
  };

  /* ── Sell Bet (early exit) ── */
  const handleSellBet = async (bet: ActiveBet) => {
    if (!walletAddress || !bet.tokenId || sellingId) return;
    setSellingId(bet.id);
    setError(null);

    try {
      // Use executeTrade with SELL side
      const result = await executeTrade({
        tokenId: bet.tokenId,
        side: "SELL",
        amount: bet.shares, // sell all shares
        price: bet.entryPrice, // market price will be used
        direction: bet.side === "UP" ? "YES" : "NO",
        source: "arcade",
        sourceId: session?.id,
      });

      if (!result.success) {
        setError(result.error || "Sell failed");
        return;
      }

      // Remove from active bets
      setActiveBets((prev) => prev.filter((b) => b.id !== bet.id));

      // Cancel any pending resolution timer
      const timer = resolveTimersRef.current.get(bet.id);
      if (timer) {
        clearTimeout(timer);
        resolveTimersRef.current.delete(bet.id);
      }

      // Estimate proceeds and update balance
      const proceeds = bet.shares * bet.entryPrice; // approximate
      setSession((s) =>
        s ? { ...s, currentBalance: s.currentBalance + proceeds } : s
      );
    } catch {
      setError("Network error selling position.");
    } finally {
      setSellingId(null);
    }
  };

  /* ── Snake Game: round ended ── */
  const handleGameRoundEnd = useCallback(
    async (summary: GameRoundSummary) => {
      if (summary.score > 0 && walletAddress) {
        try {
          await fetch("/api/points/award", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              wallet: walletAddress,
              points: summary.score,
              reason: "arcade_game",
              metadata: {
                maxCombo: summary.maxCombo,
                itemsCollected: summary.itemsCollected,
                obstaclesHit: summary.obstaclesHit,
                sessionId: session?.id,
              },
            }),
          });
        } catch {
          // Non-critical
        }
      }
    },
    [walletAddress, session?.id]
  );

  /* ── Resolve Bet (per-trade) ── */
  const resolveArcadeBet = useCallback(
    async (tradeId: string) => {
      if (!walletAddress || !session?.id) return;

      // Mark this specific bet as resolving
      setActiveBets((prev) =>
        prev.map((b) => (b.id === tradeId ? { ...b, status: "resolving" as const } : b))
      );

      let retries = 0;
      const maxRetries = 12;

      const tryResolve = async (): Promise<boolean> => {
        try {
          const res = await fetch("/api/bot/resolve-bet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              walletAddress,
              sessionId: session.id,
              tradeId,
            }),
          });

          const data = await res.json();

          if (data.pending) {
            return false;
          }

          if (!res.ok) {
            setError(data.error || "Failed to resolve bet");
            setActiveBets((prev) => prev.filter((b) => b.id !== tradeId));
            return true;
          }

          // Mark resolved with result
          setActiveBets((prev) =>
            prev.map((b) =>
              b.id === tradeId
                ? {
                    ...b,
                    status: "resolved" as const,
                    result: { outcome: data.outcome, pnl: data.pnl },
                  }
                : b
            )
          );

          // Update session
          setSession((s) =>
            s
              ? {
                  ...s,
                  currentBalance: data.currentBalance,
                  totalPnl: data.totalPnl,
                  wins: data.wins,
                  losses: data.losses,
                  betsRemaining: data.betsRemaining,
                }
              : s
          );

          // Refresh trade log
          if (walletAddress && session.id) {
            const tradesRes = await fetch(
              `/api/bot/trades?wallet=${walletAddress}&sessionId=${session.id}`
            );
            if (tradesRes.ok) {
              const tradesData = await tradesRes.json();
              setTrades(tradesData.trades || []);
            }
          }

          // Remove resolved bet after flash
          setTimeout(() => {
            setActiveBets((prev) => prev.filter((b) => b.id !== tradeId));
          }, 3000);

          // Check if session ended
          if (data.sessionEnded) {
            setBotStatus("stopped");
            setTimeout(() => {
              setBotStatus("idle");
              setSession(null);
              setTrades([]);
              setActiveBets([]);
              setDisclaimerChecked(false);
            }, 5000);
          }

          return true;
        } catch {
          return false;
        }
      };

      const resolved = await tryResolve();
      if (!resolved) {
        const retryInterval = setInterval(async () => {
          retries++;
          const done = await tryResolve();
          if (done || retries >= maxRetries) {
            clearInterval(retryInterval);
            resolveRetryRefs.current.delete(tradeId);
            if (!done) {
              setError("Market resolution timed out. Your bet will be refunded.");
              setActiveBets((prev) => prev.filter((b) => b.id !== tradeId));
            }
          }
        }, 10000);
        resolveRetryRefs.current.set(tradeId, retryInterval);
      }

      // Clean up resolve timer
      resolveTimersRef.current.delete(tradeId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [walletAddress, session?.id]
  );

  /* ── Poll market info for odds ── */
  useEffect(() => {
    if (!isRunning) {
      if (marketPollRef.current) {
        clearInterval(marketPollRef.current);
        marketPollRef.current = null;
      }
      return;
    }

    fetchMarketInfo();
    marketPollRef.current = setInterval(fetchMarketInfo, 15000);

    return () => {
      if (marketPollRef.current) {
        clearInterval(marketPollRef.current);
        marketPollRef.current = null;
      }
    };
  }, [isRunning, fetchMarketInfo]);

  /* ── Check for existing active session on mount ── */
  useEffect(() => {
    if (!walletAddress) return;
    if (botStatus !== "idle") return;

    const checkExisting = async () => {
      try {
        const res = await fetch(`/api/bot/status?wallet=${walletAddress}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.active && data.session) {
          setSession({
            id: data.session.id,
            status: data.session.status,
            market: data.session.market,
            bankroll: data.session.bankroll,
            currentBalance: data.session.currentBalance,
            totalPnl: data.session.totalPnl,
            trades: data.session.trades,
            wins: data.session.wins,
            losses: data.session.losses,
            betsRemaining: data.session.betsRemaining ?? 0,
          });
          setBotStatus("running");
          setBankroll(data.session.bankroll);
          setBetAmount(data.session.betAmount || 1);

          // Restore all active bets (multi-window)
          const serverBets: any[] = data.activeBets || (data.activeBet ? [data.activeBet] : []);
          if (serverBets.length > 0) {
            const restoredBets: ActiveBet[] = serverBets.map((bet: any) => {
              const marketMinutes = 5;
              const endTime = bet.marketEndTime
                ? (typeof bet.marketEndTime === 'number' ? bet.marketEndTime : new Date(bet.marketEndTime).getTime())
                : new Date(bet.createdAt).getTime() + marketMinutes * 60 * 1000;
              const shares = bet.entryPrice > 0 ? bet.amount / bet.entryPrice : 0;

              return {
                id: bet.id || `restored-${Date.now()}-${Math.random()}`,
                side: bet.side as "UP" | "DOWN",
                entryPrice: bet.entryPrice,
                amount: bet.amount,
                shares,
                market: bet.market || "BTC-5m",
                slug: bet.slug || "",
                marketEndTime: endTime,
                status: "live" as const,
                tokenId: bet.tokenId,
              };
            });

            setActiveBets(restoredBets);

            // Schedule resolution timers for each
            for (const bet of restoredBets) {
              if (Date.now() > bet.marketEndTime) {
                resolveArcadeBet(bet.id);
              } else {
                const msUntilEnd = bet.marketEndTime - Date.now();
                const timer = setTimeout(() => {
                  resolveArcadeBet(bet.id);
                }, Math.max(msUntilEnd + 2000, 2000));
                resolveTimersRef.current.set(bet.id, timer);
              }
            }
          }

          // Fetch trade history
          const tradesRes = await fetch(
            `/api/bot/trades?wallet=${walletAddress}&sessionId=${data.session.id}`
          );
          if (tradesRes.ok) {
            const tradesData = await tradesRes.json();
            setTrades(tradesData.trades || []);
          }
        }
      } catch (err) {
        console.error("Session check error:", err);
      }
    };

    checkExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  /* ── Cleanup timers on unmount ── */
  useEffect(() => {
    return () => {
      resolveTimersRef.current.forEach((t) => clearTimeout(t));
      resolveRetryRefs.current.forEach((t) => clearInterval(t));
      if (marketPollRef.current) clearInterval(marketPollRef.current);
    };
  }, []);

  // ── Render ──
  return (
    <div className="py-6 space-y-6">
      {/* Header — EasyP mascot + speech bubble */}
      <div className="flex items-start gap-4" data-tour="arcade-header">
        <img
          src="/easyp.jpg"
          alt="EasyP"
          className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl border border-accent/20 shadow-glow-sm flex-shrink-0"
        />
        <div className="relative bg-ep-card border border-ep-border rounded-2xl rounded-bl-none px-5 py-3">
          {/* Speech bubble tail */}
          <div className="absolute -left-2 bottom-4 w-0 h-0 border-t-[8px] border-t-transparent border-r-[8px] border-r-ep-border border-b-[8px] border-b-transparent" />
          <div className="absolute -left-[7px] bottom-4 w-0 h-0 border-t-[8px] border-t-transparent border-r-[8px] border-r-ep-card border-b-[8px] border-b-transparent" />
          <h1 className="font-display text-xl sm:text-2xl font-bold text-text-primary">
            Arcade <span className="text-2xl">🕹️</span>
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            {isRunning ? (
              <>
                <span className="text-accent font-semibold">Multi-Chart Rapid Fire!</span>{" "}
                Trade BTC + ETH across 5-min windows. Sell early or ride to resolution!
              </>
            ) : wizardStep === 1 ? (
              <>
                <span className="text-accent font-semibold">Pick your bet size</span>{" "}
                — each click on the chart = one bet!
              </>
            ) : wizardStep === 2 ? (
              <>
                <span className="text-accent font-semibold">Load up your credits</span>{" "}
                — more bets = more chances!
              </>
            ) : (
              <>
                <span className="text-accent font-semibold">Let&apos;s go!</span>{" "}
                You&apos;ll see 4 live charts to trade on.
              </>
            )}
          </p>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="ep-card p-3 border border-loss/30 bg-loss/[0.05] flex items-center justify-between">
          <p className="text-xs text-loss">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-loss/60 hover:text-loss text-sm ml-3"
          >
            ✕
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {botStatus === "idle" ? (
          /* ══════════════════════════════════════════════
             SETUP WIZARD — 3 Steps
             ══════════════════════════════════════════════ */
          <motion.div
            key="setup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* ── Progress Dots ── */}
            <div className="flex items-center justify-center gap-0">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      wizardStep === step
                        ? "bg-accent text-ep-bg shadow-glow-sm"
                        : wizardStep > step
                        ? "bg-accent/20 text-accent"
                        : "bg-ep-surface text-text-muted border border-ep-border"
                    }`}
                  >
                    {wizardStep > step ? (
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      step
                    )}
                  </div>
                  {step < 3 && (
                    <div
                      className={`w-12 sm:w-16 h-0.5 transition-all ${
                        wizardStep > step ? "bg-accent/40" : "bg-ep-border"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* ── Arcade Preview (Synthdata + Charts) ── */}
            <div className="space-y-3">
              {/* Synthdata AI Predictions */}
              <div className="space-y-2">
                <SynthdataPrediction asset="BTC" />
                <SynthdataPrediction asset="ETH" />
              </div>

              {/* 2x2 Chart Preview Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* BTC Current - Preview */}
                <div className="ep-card overflow-hidden border-2 border-ep-border">
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-ep-border bg-ep-surface/50">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider">BTC 5m</span>
                      <span className="text-[9px] text-accent font-semibold">Current</span>
                    </div>
                    <span className="text-[9px] text-text-muted font-mono">{currentTimeRange}</span>
                  </div>
                  <div className="relative h-[180px] bg-gradient-to-br from-ep-bg to-ep-surface flex items-center justify-center">
                    <div className="absolute inset-0 opacity-20">
                      <svg viewBox="0 0 200 100" className="w-full h-full">
                        <polyline
                          points="0,60 20,55 40,50 60,45 80,40 100,35 120,30 140,35 160,40 180,45 200,50"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-accent"
                        />
                      </svg>
                    </div>
                    <div className="text-center z-10">
                      <p className="text-xs text-text-muted mb-1">Live Chart Preview</p>
                      <p className="text-sm font-mono text-accent">${btcPrice.currentPrice.toFixed(0)}</p>
                    </div>
                  </div>
                </div>

                {/* BTC Next - Preview */}
                <div className="ep-card overflow-hidden border-2 border-ep-border opacity-60">
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-ep-border bg-ep-surface/50">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider">BTC 5m</span>
                      <span className="text-[9px] text-accent font-semibold">Next</span>
                    </div>
                    <span className="text-[9px] text-text-muted font-mono">{nextTimeRange}</span>
                  </div>
                  <div className="h-[180px] bg-gradient-to-br from-ep-bg to-ep-surface flex items-center justify-center">
                    <p className="text-xs text-text-muted">Preview</p>
                  </div>
                </div>

                {/* ETH Current - Preview */}
                <div className="ep-card overflow-hidden border-2 border-ep-border">
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-ep-border bg-ep-surface/50">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider">ETH 5m</span>
                      <span className="text-[9px] text-accent font-semibold">Current</span>
                    </div>
                    <span className="text-[9px] text-text-muted font-mono">{currentTimeRange}</span>
                  </div>
                  <div className="relative h-[180px] bg-gradient-to-br from-ep-bg to-ep-surface flex items-center justify-center">
                    <div className="absolute inset-0 opacity-20">
                      <svg viewBox="0 0 200 100" className="w-full h-full">
                        <polyline
                          points="0,50 20,48 40,45 60,43 80,40 100,45 120,50 140,55 160,52 180,50 200,48"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-accent"
                        />
                      </svg>
                    </div>
                    <div className="text-center z-10">
                      <p className="text-xs text-text-muted mb-1">Live Chart Preview</p>
                      <p className="text-sm font-mono text-accent">${ethPrice.currentPrice.toFixed(0)}</p>
                    </div>
                  </div>
                </div>

                {/* ETH Next - Preview */}
                <div className="ep-card overflow-hidden border-2 border-ep-border opacity-60">
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-ep-border bg-ep-surface/50">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider">ETH 5m</span>
                      <span className="text-[9px] text-accent font-semibold">Next</span>
                    </div>
                    <span className="text-[9px] text-text-muted font-mono">{nextTimeRange}</span>
                  </div>
                  <div className="h-[180px] bg-gradient-to-br from-ep-bg to-ep-surface flex items-center justify-center">
                    <p className="text-xs text-text-muted">Preview</p>
                  </div>
                </div>
              </div>

              {/* Hint text */}
              <p className="text-xs text-center text-text-muted/70">
                👆 Click UP or DOWN on any chart to place instant $1 bets
              </p>
            </div>

            <AnimatePresence mode="wait">
              {/* ══ STEP 1: Bet Size ══ */}
              {wizardStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  <div className="text-center space-y-1">
                    <h2 className="text-lg font-bold text-text-primary">How much per bet?</h2>
                    <p className="text-xs text-text-muted">Each click on UP or DOWN places a real bet on Polymarket</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {BET_AMOUNT_OPTIONS.map((v) => (
                      <button
                        key={v}
                        onClick={() => setBetAmount(v)}
                        className={`py-6 rounded-2xl text-center font-bold text-2xl transition-all ${
                          betAmount === v
                            ? "bg-accent/10 text-accent border-2 border-accent/40 shadow-glow-sm scale-[1.02]"
                            : "bg-ep-surface text-text-muted border-2 border-ep-border hover:border-text-muted/30 hover:text-text-secondary"
                        }`}
                      >
                        ${v}
                        {betAmount === v && (
                          <p className="text-[10px] font-medium text-accent/70 mt-1">per bet</p>
                        )}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setWizardStep(2)}
                    className="w-full py-3.5 rounded-xl bg-accent text-ep-bg font-bold text-sm hover:bg-accent/90 transition flex items-center justify-center gap-2"
                  >
                    Next — Choose Credits
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </motion.div>
              )}

              {/* ══ STEP 2: Credits / Bankroll ══ */}
              {wizardStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  <div className="text-center space-y-1">
                    <h2 className="text-lg font-bold text-text-primary">How many bets do you want?</h2>
                    <p className="text-xs text-text-muted">More bets = more chances to win</p>
                  </div>

                  {/* Big number display */}
                  <div className="ep-card p-6 text-center space-y-4">
                    <div>
                      <span className="text-5xl font-mono font-bold text-accent">{totalBets}</span>
                      <p className="text-sm text-text-muted mt-1">bets</p>
                    </div>

                    <input
                      type="range"
                      min={10}
                      max={500}
                      step={betAmount}
                      value={bankroll}
                      onChange={(e) => setBankroll(parseInt(e.target.value))}
                      className="w-full h-2 bg-ep-border rounded-full appearance-none cursor-pointer
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6
                        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-glow-sm
                        [&::-webkit-slider-thumb]:cursor-pointer"
                    />

                    <p className="text-xs text-text-muted">
                      ${bankroll} USDC for {totalBets} bets at ${betAmount} each
                    </p>

                    {/* Quick presets */}
                    <div className="flex flex-wrap justify-center gap-2">
                      {[10, 25, 50, 100].map((count) => {
                        const cost = count * betAmount;
                        return (
                          <button
                            key={count}
                            onClick={() => setBankroll(cost)}
                            className={`px-4 py-2 rounded-full text-xs font-semibold transition ${
                              totalBets === count
                                ? "bg-accent/15 text-accent border border-accent/30"
                                : "bg-ep-surface text-text-muted border border-ep-border hover:text-text-secondary hover:border-text-muted/30"
                            }`}
                          >
                            {count} bets
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setWizardStep(1)}
                      className="flex-1 py-3 rounded-xl bg-ep-surface text-text-secondary font-medium text-sm border border-ep-border hover:bg-ep-card transition flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                      </svg>
                      Back
                    </button>
                    <button
                      onClick={() => setWizardStep(3)}
                      disabled={bankroll < betAmount}
                      className="flex-[2] py-3 rounded-xl bg-accent text-ep-bg font-bold text-sm hover:bg-accent/90 transition disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      Next — Review
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ══ STEP 3: Confirm & Start ══ */}
              {wizardStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  <div className="text-center space-y-1">
                    <h2 className="text-lg font-bold text-text-primary">Ready to play!</h2>
                    <p className="text-xs text-text-muted">Review your setup and hit start</p>
                  </div>

                  {/* Recap card */}
                  <div className="ep-card p-5 space-y-3 border border-accent/20">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-text-secondary">Bet size</span>
                      <span className="text-sm font-mono font-bold text-text-primary">${betAmount}</span>
                    </div>
                    <div className="h-px bg-ep-border" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-text-secondary">Total bets</span>
                      <span className="text-sm font-mono font-bold text-accent">{totalBets}</span>
                    </div>
                    <div className="h-px bg-ep-border" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-text-secondary">Total cost</span>
                      <span className="text-sm font-mono font-bold text-text-primary">${bankroll} USDC</span>
                    </div>
                    {polyBalance !== null && (
                      <>
                        <div className="h-px bg-ep-border" />
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-text-secondary">Polymarket balance</span>
                          <span
                            className={`text-sm font-mono font-bold ${polyBalance >= bankroll ? "text-profit" : "text-loss"}`}
                          >
                            ${polyBalance.toFixed(2)} USDC
                          </span>
                        </div>
                      </>
                    )}
                    {polyBalance !== null && polyBalance < bankroll && (
                      <p className="text-[10px] text-loss">
                        Insufficient balance. Deposit USDC.e at{" "}
                        <a
                          href="https://polymarket.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          polymarket.com
                        </a>{" "}
                        to play.
                      </p>
                    )}
                  </div>

                  {/* How it works — compact */}
                  <div className="ep-card p-4 space-y-2.5">
                    <div className="flex items-start gap-3">
                      <span className="text-base mt-0.5">🎯</span>
                      <p className="text-xs text-text-secondary">
                        Click <strong className="text-profit">UP</strong> or <strong className="text-loss">DOWN</strong> on 4 live BTC + ETH charts
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-base mt-0.5">⚡</span>
                      <p className="text-xs text-text-secondary">
                        Up to 5 bets at once — sell early or wait for resolution
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-base mt-0.5">💰</span>
                      <p className="text-xs text-text-secondary">
                        Win if price goes your way at the 5-min mark
                      </p>
                    </div>
                  </div>

                  {/* Disclaimer */}
                  <div className="ep-card p-4 border border-conviction-medium/20 bg-conviction-medium/[0.03]">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={disclaimerChecked}
                        onChange={(e) => setDisclaimerChecked(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-ep-border bg-ep-surface text-accent focus:ring-accent/30 cursor-pointer"
                      />
                      <div className="space-y-1">
                        <p className="text-xs text-text-secondary leading-relaxed">
                          I understand each click places a{" "}
                          <strong className="text-text-primary">real ${betAmount} bet on Polymarket</strong>. I may lose
                          some or all of my credits.
                        </p>
                        <p className="text-[10px] text-text-muted">
                          For entertainment only. Not financial advice. Play responsibly.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setWizardStep(2)}
                      className="flex-1 py-3 rounded-xl bg-ep-surface text-text-secondary font-medium text-sm border border-ep-border hover:bg-ep-card transition flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                      </svg>
                      Back
                    </button>
                    <button
                      onClick={handleStart}
                      disabled={
                        !walletAddress ||
                        !disclaimerChecked ||
                        starting ||
                        bankroll < 10 ||
                        !hasCredentials ||
                        (polyBalance !== null && polyBalance < bankroll)
                      }
                      className="flex-[2] py-3.5 rounded-xl bg-accent text-ep-bg font-bold text-sm hover:bg-accent/90 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {starting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-ep-bg/30 border-t-ep-bg rounded-full animate-spin" />
                          Starting...
                        </>
                      ) : !walletAddress ? (
                        "Connect Wallet"
                      ) : !hasCredentials ? (
                        "Connect Polymarket"
                      ) : (
                        <>
                          🔥 Start Rapid Fire
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          /* ══════════════════════════════════════════════
             ARCADE RUNNING VIEW — 2x2 Multi-Chart Grid
             ══════════════════════════════════════════════ */
          <motion.div
            key="arcade-running"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* ── Stats Bar ── */}
            {session && (
              <div className="grid grid-cols-4 gap-2">
                <div className="ep-card p-3 text-center">
                  <p className="text-[10px] text-text-muted uppercase tracking-wider">Credits</p>
                  <p className="text-lg font-mono font-bold text-accent mt-0.5">
                    {session.betsRemaining ?? 0}
                  </p>
                </div>
                <div className="ep-card p-3 text-center">
                  <p className="text-[10px] text-text-muted uppercase tracking-wider">Balance</p>
                  <p className="text-lg font-mono font-bold text-text-primary mt-0.5">
                    ${session.currentBalance.toFixed(2)}
                  </p>
                </div>
                <div className="ep-card p-3 text-center">
                  <p className="text-[10px] text-text-muted uppercase tracking-wider">W-L</p>
                  <p className="text-lg font-mono font-bold text-text-primary mt-0.5">
                    {session.wins}-{session.losses}
                  </p>
                </div>
                <div className="ep-card p-3 text-center">
                  <p className="text-[10px] text-text-muted uppercase tracking-wider">P&L</p>
                  <p
                    className={`text-lg font-mono font-bold mt-0.5 ${session.totalPnl >= 0 ? "text-profit" : "text-loss"}`}
                  >
                    {session.totalPnl >= 0 ? "+" : ""}
                    {session.totalPnl.toFixed(2)}
                  </p>
                </div>
              </div>
            )}

            {/* ── Countdown Timer ── */}
            <div className="ep-card p-6 border-2 border-accent/20 bg-gradient-to-br from-accent/[0.03] to-transparent">
              <ArcadeCountdown windowEndTimestamp={nextWindowTs} intervalMinutes={5} />
            </div>

            {/* ── Synthdata AI Predictions ── */}
            <div className="space-y-2">
              <SynthdataPrediction asset="BTC" />
              <SynthdataPrediction asset="ETH" />
            </div>

            {/* ── 2x2 Chart Grid ── */}
            <div className="grid grid-cols-2 gap-3">
              {/* BTC Current */}
              <ArcadeChartCell
                asset="btcusdt"
                windowLabel="Current"
                windowTimeRange={currentTimeRange}
                pricesRef={btcPrice.pricesRef}
                latestPriceRef={btcPrice.latestPriceRef}
                smoothPriceRef={btcPrice.smoothPriceRef}
                currentPrice={btcPrice.currentPrice}
                connected={btcPrice.connected}
                activeBet={getBetForCell("BTC-5m", "Current")}
                canPlaceBet={canPlaceBet}
                clicking={clicking}
                betAmount={betAmount}
                yesPrice={marketInfoMap["BTC-5m"]?.yesPrice ?? null}
                noPrice={marketInfoMap["BTC-5m"]?.noPrice ?? null}
                onClickBet={(side) => handleClickBet(side, "BTC-5m")}
                onSellBet={handleSellBet}
                onFrameData={setFrameData}
              />

              {/* BTC Next */}
              <ArcadeChartCell
                asset="btcusdt"
                windowLabel="Next"
                windowTimeRange={nextTimeRange}
                pricesRef={btcPrice.pricesRef}
                latestPriceRef={btcPrice.latestPriceRef}
                smoothPriceRef={btcPrice.smoothPriceRef}
                currentPrice={btcPrice.currentPrice}
                connected={btcPrice.connected}
                activeBet={null}
                canPlaceBet={canPlaceBet}
                clicking={clicking}
                betAmount={betAmount}
                yesPrice={null}
                noPrice={null}
                onClickBet={(side) => handleClickBet(side, "BTC-5m")}
                onSellBet={handleSellBet}
              />

              {/* ETH Current */}
              <ArcadeChartCell
                asset="ethusdt"
                windowLabel="Current"
                windowTimeRange={currentTimeRange}
                pricesRef={ethPrice.pricesRef}
                latestPriceRef={ethPrice.latestPriceRef}
                smoothPriceRef={ethPrice.smoothPriceRef}
                currentPrice={ethPrice.currentPrice}
                connected={ethPrice.connected}
                activeBet={getBetForCell("ETH-5m", "Current")}
                canPlaceBet={canPlaceBet}
                clicking={clicking}
                betAmount={betAmount}
                yesPrice={marketInfoMap["ETH-5m"]?.yesPrice ?? null}
                noPrice={marketInfoMap["ETH-5m"]?.noPrice ?? null}
                onClickBet={(side) => handleClickBet(side, "ETH-5m")}
                onSellBet={handleSellBet}
              />

              {/* ETH Next */}
              <ArcadeChartCell
                asset="ethusdt"
                windowLabel="Next"
                windowTimeRange={nextTimeRange}
                pricesRef={ethPrice.pricesRef}
                latestPriceRef={ethPrice.latestPriceRef}
                smoothPriceRef={ethPrice.smoothPriceRef}
                currentPrice={ethPrice.currentPrice}
                connected={ethPrice.connected}
                activeBet={null}
                canPlaceBet={canPlaceBet}
                clicking={clicking}
                betAmount={betAmount}
                yesPrice={null}
                noPrice={null}
                onClickBet={(side) => handleClickBet(side, "ETH-5m")}
                onSellBet={handleSellBet}
              />
            </div>

            {/* ── Snake Game Banner ── */}
            {activeBets.some((b) => b.status === "live") && (
              <div className="relative h-[80px] overflow-hidden rounded-xl border border-ep-border">
                <SnakeGameOverlay
                  frameData={frameData}
                  arcadePhase="live"
                  activeBet={activeBetForSnake}
                  onRoundEnd={handleGameRoundEnd}
                />
              </div>
            )}

            {/* ── Active Positions (with SELL) ── */}
            <ArcadePositions
              activeBets={activeBets}
              currentPrices={currentPrices}
              onSellBet={handleSellBet}
              sellingId={sellingId}
            />

            {/* ── Order Book + Trade Feed ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ArcadeOrderBook
                tokenId={marketInfoMap["BTC-5m"]?.tokenId ?? null}
                assetLabel="BTC"
              />
              <ArcadeTradeFeed
                conditionId={marketInfoMap["BTC-5m"]?.conditionId ?? null}
                assetLabel="BTC"
              />
            </div>

            {/* ── Bet Count + Cash Out ── */}
            <div className="flex items-center justify-between">
              <div>
                {activeBets.length > 0 && (
                  <p className="text-sm text-text-secondary">
                    <span className="font-mono text-accent font-bold">{activeBets.length}</span>
                    /{MAX_CONCURRENT_BETS} bets active
                    {canPlaceBet && (
                      <span className="text-text-muted"> — click to stack more!</span>
                    )}
                  </p>
                )}
                {session && (session.betsRemaining ?? 0) <= 0 && activeBets.length === 0 && (
                  <p className="text-xs text-conviction-medium font-semibold">
                    No credits remaining — game over!
                  </p>
                )}
              </div>
              <button
                onClick={handleStop}
                className="px-4 py-2 rounded-lg bg-loss/10 text-loss text-xs font-medium border border-loss/20 hover:bg-loss/20 transition"
              >
                Cash Out
              </button>
            </div>

            {/* ── Trade Log ── */}
            <div className="ep-card overflow-hidden">
              <div className="p-4 border-b border-ep-border">
                <h3 className="text-sm font-semibold text-text-primary">Your Guesses</h3>
              </div>
              {trades.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-xs text-text-muted">
                    No guesses yet. Click UP or DOWN on any chart to play!
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-ep-border max-h-64 overflow-y-auto">
                  {trades.map((t) => (
                    <div key={t.id} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded ${
                            t.side === "UP" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"
                          }`}
                        >
                          {t.side}
                        </span>
                        <div>
                          <p className="text-xs text-text-primary">
                            {t.market} &middot; ${t.amount.toFixed(2)}
                          </p>
                          <p className="text-[10px] text-text-muted">
                            @ {(t.entryPrice * 100).toFixed(0)}c
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {t.outcome === "pending" ? (
                          <span className="text-xs text-conviction-medium animate-pulse">
                            Waiting...
                          </span>
                        ) : (
                          <span
                            className={`text-xs font-mono font-bold ${
                              t.outcome === "won" ? "text-profit" : "text-loss"
                            }`}
                          >
                            {t.pnl >= 0 ? "+" : ""}
                            {t.pnl.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── First-visit Arcade Tour ── */}
      <ArcadeTour />
    </div>
  );
}
