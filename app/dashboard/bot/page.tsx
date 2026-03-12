"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { useUserStore } from "@/app/lib/stores/user-store";
import { useClobClient } from "@/app/lib/hooks/useClobClient";
import { useBinancePrice } from "@/app/lib/hooks/useBinancePrice";
import { useSynthMarkets, type SynthMarketData } from "@/app/lib/hooks/useSynthMarkets";
import { SynthMarketCard, type Position } from "@/app/components/ui/SynthMarketCard";
import { useUsdcBalance } from "@/app/lib/hooks/useUsdcBalance";
import { useToast } from "@/app/components/ui/Toast";

/* ── Constants ─────────────────────────────────── */
const HOURLY_KEYS = ["BTC-hourly", "ETH-hourly", "SOL-hourly"];
const FIFTEEN_KEYS = ["BTC-15min", "ETH-15min", "SOL-15min"];
const DEFAULT_AMOUNT = 5;

/* ── Page ──────────────────────────────────────── */
export default function SynthTradingPage() {
  const { walletAddress, isConnected } = useUserStore();
  const { createOrder, sellPosition, isReady: clobReady } = useClobClient();
  const { balance: usdcBalance, formatted: balanceFormatted, refetch: refetchBalance } = useUsdcBalance();
  const { toast } = useToast();

  // Live prices
  const btcPrice = useBinancePrice("btcusdt");
  const ethPrice = useBinancePrice("ethusdt");
  const solPrice = useBinancePrice("solusdt");

  const priceMap: Record<string, typeof btcPrice> = {
    BTC: btcPrice,
    ETH: ethPrice,
    SOL: solPrice,
  };

  // Synth market data
  const { markets, loading: marketsLoading } = useSynthMarkets(true);

  // UI state — expandedKey uses ref + counter to survive rapid WebSocket re-renders
  const expandedKeyRef = useRef<string | null>(null);
  const [, forceExpandRender] = useState(0);
  const expandedKey = expandedKeyRef.current;
  const [tradingKey, setTradingKey] = useState<string | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [defaultAmount] = useState(DEFAULT_AMOUNT);

  // Resolution timers
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  /* ── Toggle expand — uses ref so value survives rapid re-renders ── */
  const toggleExpand = useCallback((key: string) => {
    console.log('[Synth] toggleExpand called:', key, 'current:', expandedKeyRef.current);
    expandedKeyRef.current = expandedKeyRef.current === key ? null : key;
    forceExpandRender((c) => c + 1);
  }, []);

  /* ── Resolve a position ─────────────────────── */
  const resolvePosition = useCallback(
    async (posId: string, retries = 0) => {
      if (!walletAddress) return;

      try {
        const res = await fetch("/api/trades/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress }),
        });

        if (res.ok) {
          const data = await res.json();
          // Check if our position was resolved
          const resolved = data.resolved || [];
          const match = resolved.find((r: any) => r.id === posId || r.orderId === posId);

          if (match) {
            setPositions((prev) =>
              prev.map((p) =>
                p.id === posId
                  ? { ...p, status: match.won ? "won" as const : "lost" as const, pnl: match.pnl || 0 }
                  : p
              )
            );

            // Remove after 8 seconds
            setTimeout(() => {
              setPositions((prev) => prev.filter((p) => p.id !== posId));
            }, 8000);

            refetchBalance();
            return;
          }
        }

        // Retry if not resolved yet (max 20 retries, 15s apart)
        if (retries < 20) {
          setPositions((prev) =>
            prev.map((p) => (p.id === posId ? { ...p, status: "resolving" as const } : p))
          );
          const timer = setTimeout(() => resolvePosition(posId, retries + 1), 15_000);
          timersRef.current.set(posId, timer);
        } else {
          // Give up — mark as lost
          setPositions((prev) =>
            prev.map((p) =>
              p.id === posId ? { ...p, status: "lost" as const, pnl: -p.amount } : p
            )
          );
          setTimeout(() => {
            setPositions((prev) => prev.filter((p) => p.id !== posId));
          }, 8000);
        }
      } catch (err) {
        console.error("[Synth] Resolution error:", err);
        if (retries < 20) {
          const timer = setTimeout(() => resolvePosition(posId, retries + 1), 15_000);
          timersRef.current.set(posId, timer);
        }
      }
    },
    [walletAddress, refetchBalance]
  );

  /* ── Handle trade (Privy embedded wallet) ──── */
  const handleTrade = useCallback(
    async (side: "UP" | "DOWN", market: SynthMarketData, amount: number) => {
      if (!isConnected || !walletAddress) {
        toast("error", "Not Connected", "Please connect your wallet first.");
        return;
      }
      if (!createOrder || !clobReady) {
        toast("error", "Not Ready", "Trading session not initialized. Please wait or reconnect.");
        return;
      }

      const marketKey = `${market.asset}-${market.timeframe}`;
      // Check for existing position on this market
      const existing = positions.find(
        (p) => p.slug === market.slug && (p.status === "live" || p.status === "resolving")
      );
      if (existing) {
        toast("error", "Position Open", "You already have an active position on this market.");
        return;
      }

      // Balance check
      if (usdcBalance !== null && usdcBalance < amount) {
        toast("error", "Insufficient Balance", `Need $${amount} but have ${balanceFormatted}. Deposit more USDC.`);
        return;
      }

      setTradingKey(marketKey);

      try {
        // 1. Resolve token ID from slug
        const direction = side === "UP" ? "YES" : "NO";
        const synthSide = side;
        const detailsRes = await fetch(
          `/api/synth/market-details?slug=${encodeURIComponent(market.slug)}&side=${synthSide}`
        );

        if (!detailsRes.ok) {
          const err = await detailsRes.json().catch(() => ({}));
          throw new Error(err.error || "Failed to fetch market details");
        }

        const details = await detailsRes.json();
        const { tokenId, price, marketEndTime } = details;

        if (!tokenId || !price) {
          throw new Error("Market data unavailable");
        }

        // 2. Place trade via Privy embedded wallet → CLOB
        const result = await createOrder({
          tokenID: tokenId,
          side: "BUY",
          size: Math.ceil((Math.max(amount, 1.01) / price) * 100) / 100,
          price,
        });

        // Extract order ID from CLOB response
        const orderId = result?.orderID || result?.id || result?.order_id || `pos-${Date.now()}`;

        // 3. Log trade to our DB (non-blocking)
        fetch("/api/trade/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress,
            tokenId,
            side: "BUY",
            direction,
            amount,
            price,
            orderId,
            source: "synth-trading",
            sourceId: market.slug,
          }),
        }).catch(() => {}); // non-critical

        // 4. Create local position
        const tfShort = market.timeframe === "hourly" ? "1h" : "15m";
        const posId = typeof orderId === "string" ? orderId : `pos-${Date.now()}`;
        const newPosition: Position = {
          id: posId,
          tokenId,
          slug: market.slug,
          market: `${market.asset}-${tfShort}`,
          asset: market.asset as "BTC" | "ETH" | "SOL",
          side,
          entryPrice: price,
          amount,
          shares: amount / price,
          marketEndTime: marketEndTime || new Date(market.event_end_time).getTime(),
          status: "live",
          orderId: posId,
          createdAt: Date.now(),
        };

        setPositions((prev) => [newPosition, ...prev]);
        refetchBalance();

        toast(
          "success",
          "Trade Placed!",
          `$${amount} ${side} on ${market.asset} ${tfShort} at ${(price * 100).toFixed(0)}¢`
        );

        // 5. Schedule resolution
        const msUntilEnd = (newPosition.marketEndTime || Date.now() + 60_000) - Date.now();
        const resolveDelay = Math.max(msUntilEnd + 10_000, 10_000); // at least 10s from now
        const timer = setTimeout(() => resolvePosition(posId), resolveDelay);
        timersRef.current.set(posId, timer);
      } catch (err: any) {
        console.error("[Synth] Trade error:", err);
        toast("error", "Trade Failed", err.message || "Something went wrong");
      } finally {
        setTradingKey(null);
      }
    },
    [isConnected, walletAddress, createOrder, clobReady, positions, usdcBalance, balanceFormatted, refetchBalance, toast, resolvePosition]
  );

  /* ── Handle sell (Privy embedded wallet) ───── */
  const handleSell = useCallback(
    async (position: Position) => {
      if (!isConnected || !walletAddress || !sellPosition) return;
      setSellingId(position.id);

      try {
        // Use market sell: price 0.01 (minimum) ensures immediate fill at best bid.
        // The CLOB matches at the best available price, not at 0.01.
        const marketSellPrice = 0.01;

        await sellPosition({
          tokenID: position.tokenId,
          size: position.shares,
          price: marketSellPrice,
        });

        // Log sell to DB (non-blocking)
        fetch("/api/trade/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress,
            tokenId: position.tokenId,
            side: "SELL",
            direction: position.side === "UP" ? "YES" : "NO",
            amount: position.amount,
            price: marketSellPrice,
            orderId: `sell-${position.id}`,
            source: "synth-trading-sell",
            sourceId: position.slug,
          }),
        }).catch(() => {});

        // Clear timer
        const timer = timersRef.current.get(position.id);
        if (timer) { clearTimeout(timer); timersRef.current.delete(position.id); }

        setPositions((prev) => prev.filter((p) => p.id !== position.id));

        // Delay balance refetch slightly so CLOB settlement has time
        setTimeout(() => refetchBalance(), 3000);
        refetchBalance();

        toast("success", "Position Sold", `Closed ${position.side} position on ${position.market}`);
      } catch (err: any) {
        toast("error", "Sell Failed", err.message || "Something went wrong");
      } finally {
        setSellingId(null);
      }
    },
    [isConnected, walletAddress, sellPosition, refetchBalance, toast]
  );

  /* ── Get position for a market ──────────────── */
  const getPosition = (market: SynthMarketData) => {
    return positions.find(
      (p) => p.slug === market.slug && (p.status === "live" || p.status === "resolving" || p.status === "won" || p.status === "lost")
    ) || null;
  };

  /* ── Asset icons for placeholder cards ──────── */
  const ASSET_ICONS: Record<string, string> = { BTC: '₿', ETH: 'Ξ', SOL: '◎' };

  /* ── Render helpers ─────────────────────────── */
  const renderMarketSection = (keys: string[], label: string) => {
    // Build entries for all 3 slots, including error/missing markets
    const marketEntries = keys.map((k) => {
      const asset = k.split('-')[0];
      const market = markets[k] as SynthMarketData | undefined;
      const hasError = !market || !market.slug || !!market.error;
      return { key: k, asset, market: hasError ? null : (market as SynthMarketData), hasError };
    });

    const hasAnyData = marketEntries.some((e) => !e.hasError);

    return (
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3 px-1">
          {label}
        </h3>

        {/* Compact cards grid — always shows 3 slots */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {marketsLoading && !hasAnyData
            ? [0, 1, 2].map((i) => (
                <div key={i} className="ep-card h-[200px] animate-pulse" />
              ))
            : marketEntries.map(({ key, asset, market, hasError }) => {
                if (hasError || !market) {
                  // Placeholder card for unavailable markets
                  return (
                    <div key={key} className="ep-card p-4 flex flex-col items-center justify-center h-[200px] opacity-40">
                      <span className="text-2xl mb-2">{ASSET_ICONS[asset] || '?'}</span>
                      <span className="text-xs text-text-muted text-center">
                        {asset} market unavailable
                      </span>
                      <span className="text-[10px] text-text-muted mt-1">Retrying automatically...</span>
                    </div>
                  );
                }

                const pData = priceMap[market.asset];
                return (
                  <SynthMarketCard
                    key={key}
                    market={market}
                    liveBinancePrice={pData.currentPrice}
                    pricesRef={pData.pricesRef}
                    latestPriceRef={pData.latestPriceRef}
                    smoothPriceRef={pData.smoothPriceRef}
                    connected={pData.connected}
                    position={getPosition(market)}
                    isExpanded={false}
                    isSelected={expandedKey === key}
                    onToggleExpand={() => toggleExpand(key)}
                    onTrade={handleTrade}
                    onSell={handleSell}
                    isTrading={tradingKey === key}
                    defaultAmount={defaultAmount}
                  />
                );
              })}
        </div>
      </div>
    );
  };

  /* ── Active positions count ─────────────────── */
  const livePositions = positions.filter((p) => p.status === "live" || p.status === "resolving");

  return (
    <div className="py-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold">
              Synth Up or Down
            </h1>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] font-bold text-purple-300 uppercase tracking-wider">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Powered by Synth AI
            </span>
          </div>
          <p className="text-sm text-text-muted mt-1">
            Trade crypto price predictions with AI edge detection. Synth&apos;s decentralized AI network
            runs 1,000 price simulations to find tradeable edges vs Polymarket.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {usdcBalance !== null && (
            <div className="text-right">
              <div className="text-[10px] text-text-muted uppercase tracking-wider">Balance</div>
              <div className="font-mono font-bold text-text-primary">{balanceFormatted}</div>
            </div>
          )}
          {livePositions.length > 0 && (
            <div className="text-right">
              <div className="text-[10px] text-text-muted uppercase tracking-wider">Positions</div>
              <div className="font-mono font-bold text-accent">{livePositions.length}</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Not connected state ── */}
      {!isConnected && (
        <div className="ep-card p-8 text-center">
          <div className="text-4xl mb-3">⚡</div>
          <h3 className="font-display text-lg font-bold mb-2">Connect to Trade</h3>
          <p className="text-sm text-text-muted max-w-md mx-auto">
            Connect your wallet to access Synth AI-powered prediction markets with edge detection on BTC, ETH, and SOL.
          </p>
        </div>
      )}

      {/* ── Market grids ── */}
      {isConnected && (
        <>
          {renderMarketSection(HOURLY_KEYS, "Hourly Markets")}
          {renderMarketSection(FIFTEEN_KEYS, "15-Minute Markets")}
        </>
      )}

      {/* ── Active Positions ── */}
      {positions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3 px-1">
            Active Positions
          </h3>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {positions.map((pos) => {
                const pData = priceMap[pos.asset];
                return (
                  <div
                    key={pos.id}
                    className={`ep-card p-4 border-l-4 transition-colors ${
                      pos.status === "won"
                        ? "border-l-profit bg-profit/5"
                        : pos.status === "lost"
                          ? "border-l-loss bg-loss/5"
                          : pos.side === "UP"
                            ? "border-l-profit"
                            : "border-l-loss"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-1 rounded font-bold text-xs ${
                            pos.side === "UP"
                              ? "bg-profit/15 text-profit"
                              : "bg-loss/15 text-loss"
                          }`}
                        >
                          {pos.side === "UP" ? "▲ UP" : "▼ DOWN"}
                        </span>
                        <div>
                          <span className="text-sm font-semibold text-text-primary">
                            {pos.market}
                          </span>
                          <div className="text-[10px] text-text-muted">
                            ${pos.amount} @ {(pos.entryPrice * 100).toFixed(0)}¢ •{" "}
                            {pos.shares.toFixed(1)} shares
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {pos.status === "live" && (
                          <>
                            <span className="text-xs font-mono text-text-muted">
                              {pData ? formatPrice(pData.currentPrice) : "..."}
                            </span>
                            <button
                              onClick={() => handleSell(pos)}
                              disabled={sellingId === pos.id}
                              className="text-xs px-3 py-1 rounded-lg bg-loss/10 text-loss border border-loss/20 hover:bg-loss/20 transition font-semibold disabled:opacity-50"
                            >
                              {sellingId === pos.id ? "Selling..." : "SELL"}
                            </button>
                          </>
                        )}
                        {pos.status === "resolving" && (
                          <span className="text-xs text-conviction-medium animate-pulse font-semibold">
                            Resolving...
                          </span>
                        )}
                        {(pos.status === "won" || pos.status === "lost") && pos.pnl !== undefined && (
                          <div className="text-right">
                            <span
                              className={`font-mono text-sm font-bold ${
                                pos.pnl >= 0 ? "text-profit" : "text-loss"
                              }`}
                            >
                              {pos.pnl >= 0 ? "+" : ""}${pos.pnl.toFixed(2)}
                            </span>
                            <div
                              className={`text-[10px] font-semibold ${
                                pos.status === "won" ? "text-profit" : "text-loss"
                              }`}
                            >
                              {pos.status === "won" ? "WON" : "LOST"}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ── How it works ── */}
      {isConnected && !marketsLoading && (
        <div className="ep-card p-5 bg-purple-500/5 border-purple-500/10">
          <h3 className="text-sm font-bold text-purple-300 mb-3">How Synth AI Edge Detection Works</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-text-muted">
            <div>
              <div className="text-purple-300 font-bold mb-1">1. AI Simulations</div>
              Synth&apos;s decentralized AI network runs 1,000 Monte Carlo price path simulations for each market.
            </div>
            <div>
              <div className="text-purple-300 font-bold mb-1">2. Edge Detection</div>
              When Synth AI probability disagrees with Polymarket&apos;s price by 5%+, there&apos;s a tradeable edge. 🔥 = strong signal.
            </div>
            <div>
              <div className="text-purple-300 font-bold mb-1">3. One-Click Trade</div>
              Click Up or Down to trade instantly on Polymarket. Your shares pay out $1 each if you&apos;re right.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Helper ────────────────────────────────────── */
function formatPrice(p: number) {
  if (p >= 10000) return `$${p.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (p >= 100) return `$${p.toLocaleString("en-US", { maximumFractionDigits: 1 })}`;
  return `$${p.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
