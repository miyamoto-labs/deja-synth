"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { FrameData } from "./snake-game/types";

/* ── Types ──────────────────────────────────────── */
interface ActiveBet {
  side: "UP" | "DOWN";
  entryPrice: number;
  amount: number;
  shares: number;
  market: string;
  marketEndTime: number; // timestamp when 5m/15m window closes
}

interface RaceViewProps {
  activeBet: ActiveBet | null;
  defaultAsset?: "btcusdt" | "ethusdt";
  onRaceEnd?: (won: boolean) => void;
  onPriceUpdate?: (price: number) => void;
  onFrameData?: (data: FrameData) => void;
}

/* ── Price Point ── */
interface PricePoint {
  time: number;
  price: number;
}

/* ── Particle ── */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  brightness: number;
}

/* ── Catmull-Rom to Bezier ── */
function catmullRomToBezier(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  tension = 0.3
) {
  return {
    cp1: {
      x: p1.x + ((p2.x - p0.x) * tension) / 3,
      y: p1.y + ((p2.y - p0.y) * tension) / 3,
    },
    cp2: {
      x: p2.x - ((p3.x - p1.x) * tension) / 3,
      y: p2.y - ((p3.y - p1.y) * tension) / 3,
    },
  };
}

/* ── Main Component ─────────────────────────────── */
export function BotRaceView({ activeBet, defaultAsset, onRaceEnd, onPriceUpdate, onFrameData }: RaceViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pricesRef = useRef<PricePoint[]>([]);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());
  const particlesRef = useRef<Particle[]>([]);
  const latestPriceRef = useRef<{ price: number; time: number }>({ price: 0, time: 0 });
  const smoothPriceRef = useRef<{ price: number; time: number }>({ price: 0, time: 0 });

  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [raceResult, setRaceResult] = useState<"won" | "lost" | null>(null);
  const [connected, setConnected] = useState(false);

  const asset = activeBet?.market?.startsWith("ETH") ? "ethusdt" : (defaultAsset || "btcusdt");

  /* ── Connect Binance WebSocket ── */
  useEffect(() => {
    // Reset data when switching asset
    pricesRef.current = [];
    particlesRef.current = [];
    latestPriceRef.current = { price: 0, time: 0 };
    smoothPriceRef.current = { price: 0, time: 0 };
    setCurrentPrice(0);
    setConnected(false);

    // Store historical points every 1s, but track live price every tick
    let lastStored = 0;

    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${asset}@trade`);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const price = parseFloat(data.p);
        const now = Date.now();

        // Update live price on EVERY tick (for smooth comet tip)
        latestPriceRef.current = { price, time: now };
        setCurrentPrice(price);
        onPriceUpdate?.(price);

        // Store historical point every 1 second (for the trail)
        if (now - lastStored > 1000) {
          lastStored = now;
          pricesRef.current.push({ time: now, price });

          const fiveMinAgo = now - 5 * 60 * 1000;
          pricesRef.current = pricesRef.current.filter((p) => p.time > fiveMinAgo);
        }
      } catch {
        // skip invalid
      }
    };

    wsRef.current = ws;
    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [asset]);

  /* ── Countdown Timer ── */
  useEffect(() => {
    if (!activeBet) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((activeBet.marketEndTime - Date.now()) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0 && !raceResult) {
        const won =
          activeBet.side === "UP"
            ? currentPrice > activeBet.entryPrice
            : currentPrice < activeBet.entryPrice;
        setRaceResult(won ? "won" : "lost");
        onRaceEnd?.(won);

        setTimeout(() => setRaceResult(null), 5000);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [activeBet, currentPrice, raceResult, onRaceEnd]);

  /* ── Canvas Drawing (Comet Effect) ── */
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, w, h);

    const storedPrices = pricesRef.current;
    if (storedPrices.length < 2) {
      animFrameRef.current = requestAnimationFrame(drawChart);
      return;
    }

    // Smooth interpolation: lerp the comet tip toward the latest live price
    const live = latestPriceRef.current;
    const smooth = smoothPriceRef.current;
    if (live.price > 0) {
      if (smooth.price === 0) {
        // First frame — snap to live price
        smooth.price = live.price;
        smooth.time = live.time;
      } else {
        // Lerp toward live price (0.15 = responsive but smooth)
        smooth.price += (live.price - smooth.price) * 0.15;
        smooth.time = Date.now();
      }
    }

    // Build render array: stored history + smooth live tip
    const prices: PricePoint[] = [...storedPrices];
    if (smooth.price > 0 && smooth.time > 0) {
      // Only add live tip if it's newer than the last stored point
      const lastStored = storedPrices[storedPrices.length - 1];
      if (smooth.time >= lastStored.time) {
        prices.push({ time: smooth.time, price: smooth.price });
      }
    }

    const padding = { top: 40, bottom: 40, left: 0, right: 80 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // Price range
    const allPrices = prices.map((p) => p.price);
    const entryPrice = activeBet?.entryPrice || 0;
    if (entryPrice > 0) allPrices.push(entryPrice);

    let minPrice = Math.min(...allPrices);
    let maxPrice = Math.max(...allPrices);
    const range = maxPrice - minPrice;
    const paddingPct = 0.15;
    minPrice -= range * paddingPct;
    maxPrice += range * paddingPct;

    const priceRange = maxPrice - minPrice || 1;

    // Time range
    const minTime = prices[0].time;
    const maxTime = prices[prices.length - 1].time;
    const timeRange = maxTime - minTime || 1;

    // Helpers
    const priceToY = (p: number) => padding.top + chartH * (1 - (p - minPrice) / priceRange);
    const timeToX = (t: number) => padding.left + chartW * ((t - minTime) / timeRange);

    /* ── 1. Grid lines ── */
    ctx.strokeStyle = "rgba(30, 34, 53, 0.5)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      const labelPrice = maxPrice - (priceRange / 4) * i;
      ctx.fillStyle = "#505672";
      ctx.font = "11px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText(`$${labelPrice.toFixed(0)}`, w - padding.right + 8, y + 4);
    }

    /* ── 2. Entry price dashed line ── */
    if (activeBet && entryPrice > 0) {
      const entryY = priceToY(entryPrice);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padding.left, entryY);
      ctx.lineTo(w - padding.right, entryY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "10px 'General Sans', sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`Entry $${entryPrice.toFixed(0)}`, w - padding.right - 4, entryY - 6);
    }

    // Latest point coords
    const lastPt = prices[prices.length - 1];
    const lx = timeToX(lastPt.time);
    const ly = priceToY(lastPt.price);

    const isWinning =
      activeBet && entryPrice > 0
        ? activeBet.side === "UP"
          ? lastPt.price > entryPrice
          : lastPt.price < entryPrice
        : true;

    const glowColor = isWinning ? "0, 240, 160" : "255, 64, 96";
    const lineColor = isWinning ? "#00F0A0" : "#FF4060";

    /* ── 3. Ambient glow wash (behind everything) ── */
    const washRadius = chartW * 0.25;
    const wash = ctx.createRadialGradient(lx, ly, 0, lx, ly, washRadius);
    wash.addColorStop(0, `rgba(${glowColor}, 0.04)`);
    wash.addColorStop(0.5, `rgba(${glowColor}, 0.015)`);
    wash.addColorStop(1, `rgba(${glowColor}, 0)`);
    ctx.fillStyle = wash;
    ctx.beginPath();
    ctx.arc(lx, ly, washRadius, 0, Math.PI * 2);
    ctx.fill();

    /* ── 4. Fill area between entry and price line ── */
    if (activeBet && entryPrice > 0 && prices.length > 2) {
      const entryY = priceToY(entryPrice);
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = lineColor;

      ctx.beginPath();
      ctx.moveTo(timeToX(prices[0].time), priceToY(prices[0].price));
      for (let i = 1; i < prices.length; i++) {
        ctx.lineTo(timeToX(prices[i].time), priceToY(prices[i].price));
      }
      ctx.lineTo(timeToX(prices[prices.length - 1].time), entryY);
      ctx.lineTo(timeToX(prices[0].time), entryY);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    /* ── 5. Price line with trailing fade + Bezier smoothing ── */
    if (prices.length >= 2) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const totalPts = prices.length;

      for (let i = 1; i < totalPts; i++) {
        const x0 = timeToX(prices[i - 1].time);
        const y0 = priceToY(prices[i - 1].price);
        const x1 = timeToX(prices[i].time);
        const y1 = priceToY(prices[i].price);

        // Progress: 0 = oldest, 1 = newest (comet tail → head)
        const progress = i / (totalPts - 1);

        // Exponential fade for comet tail
        const alpha = Math.max(0.05, Math.pow(progress, 2.5));

        // Line gets thicker toward the tip
        const lw = 1.0 + 2.0 * progress;

        // Color based on position relative to entry
        let color: string;
        if (activeBet && entryPrice > 0) {
          const aboveEntry = prices[i].price > entryPrice;
          const segWinning = activeBet.side === "UP" ? aboveEntry : !aboveEntry;
          color = segWinning ? "#00F0A0" : "#FF4060";
        } else {
          color = "#00F0A0";
        }

        ctx.globalAlpha = alpha;
        ctx.lineWidth = lw;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(x0, y0);

        // Catmull-Rom Bezier smoothing
        const pPrev =
          i >= 2
            ? { x: timeToX(prices[i - 2].time), y: priceToY(prices[i - 2].price) }
            : { x: x0, y: y0 };
        const pNext =
          i < totalPts - 1
            ? { x: timeToX(prices[i + 1].time), y: priceToY(prices[i + 1].price) }
            : { x: x1, y: y1 };

        const { cp1, cp2 } = catmullRomToBezier(pPrev, { x: x0, y: y0 }, { x: x1, y: y1 }, pNext, 0.3);

        ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, x1, y1);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
    }

    /* ── 6. Speed lines (motion blur streaks behind tip) ── */
    if (prices.length >= 3) {
      const prevPt = prices[prices.length - 2];
      const prevX = timeToX(prevPt.time);
      const speed = Math.abs(lx - prevX);

      if (speed > 2) {
        for (let s = 0; s < 4; s++) {
          const offsetY = (s - 1.5) * 8;
          const lineAlpha = 0.06 + 0.03 * Math.random();
          const lineLen = 15 + speed * 2 + Math.random() * 20;

          ctx.strokeStyle = `rgba(${glowColor}, ${lineAlpha})`;
          ctx.lineWidth = 0.5 + Math.random() * 0.5;
          ctx.beginPath();
          ctx.moveTo(lx - lineLen, ly + offsetY);
          ctx.lineTo(lx - 5, ly + offsetY);
          ctx.stroke();
        }
      }
    }

    /* ── 7. Sparkle particles ── */
    // Spawn 1-2 particles at the tip
    for (let j = 0; j < 2; j++) {
      particlesRef.current.push({
        x: lx,
        y: ly,
        vx: -0.5 - Math.random() * 1.5,
        vy: (Math.random() - 0.5) * 1.2,
        life: 1.0,
        size: 0.5 + Math.random() * 1.5,
        brightness: 0.3 + Math.random() * 0.5,
      });
    }

    // Update and draw particles
    particlesRef.current = particlesRef.current.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
      p.vy += 0.01;
      return p.life > 0;
    });

    for (const p of particlesRef.current) {
      const a = p.life * p.brightness;
      ctx.fillStyle = `rgba(${glowColor}, ${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }

    /* ── 8. Comet head — multi-layered glow ── */
    const elapsed = Date.now() - startTimeRef.current;
    const pulse = 1 + 0.15 * Math.sin((elapsed / 1500) * Math.PI * 2);

    // Layer 1: Ambient halo (outermost)
    const haloRadius = 60;
    const halo = ctx.createRadialGradient(lx, ly, 0, lx, ly, haloRadius);
    halo.addColorStop(0, `rgba(${glowColor}, 0.15)`);
    halo.addColorStop(0.4, `rgba(${glowColor}, 0.06)`);
    halo.addColorStop(1, `rgba(${glowColor}, 0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(lx, ly, haloRadius, 0, Math.PI * 2);
    ctx.fill();

    // Layer 2: Core glow
    const coreGlowRadius = 30;
    const coreGlow = ctx.createRadialGradient(lx, ly, 0, lx, ly, coreGlowRadius);
    coreGlow.addColorStop(0, `rgba(${glowColor}, 0.6)`);
    coreGlow.addColorStop(0.3, `rgba(${glowColor}, 0.25)`);
    coreGlow.addColorStop(1, `rgba(${glowColor}, 0)`);
    ctx.fillStyle = coreGlow;
    ctx.beginPath();
    ctx.arc(lx, ly, coreGlowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Layer 3: White-hot center bloom
    const whiteGlow = ctx.createRadialGradient(lx, ly, 0, lx, ly, 12);
    whiteGlow.addColorStop(0, "rgba(255, 255, 255, 0.7)");
    whiteGlow.addColorStop(0.5, "rgba(255, 255, 255, 0.15)");
    whiteGlow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = whiteGlow;
    ctx.beginPath();
    ctx.arc(lx, ly, 12, 0, Math.PI * 2);
    ctx.fill();

    // Layer 4: Directional light cone (headlight beam)
    if (prices.length >= 2) {
      const prevPt = prices[prices.length - 2];
      const px = timeToX(prevPt.time);
      const py = priceToY(prevPt.price);

      const dx = lx - px;
      const dy = ly - py;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / len;
      const ny = dy / len;

      const coneLen = 40;
      const coneTipX = lx + nx * coneLen;
      const coneTipY = ly + ny * coneLen;

      const cone = ctx.createRadialGradient(lx, ly, 2, coneTipX, coneTipY, coneLen);
      cone.addColorStop(0, `rgba(${glowColor}, 0.3)`);
      cone.addColorStop(0.5, `rgba(${glowColor}, 0.08)`);
      cone.addColorStop(1, `rgba(${glowColor}, 0)`);
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.arc(lx, ly, coneLen, 0, Math.PI * 2);
      ctx.fill();
    }

    // Layer 5: Pulsating colored dot
    const dotRadius = 5 * pulse;
    ctx.fillStyle = lineColor;
    ctx.beginPath();
    ctx.arc(lx, ly, dotRadius, 0, Math.PI * 2);
    ctx.fill();

    // Layer 6: White-hot inner core
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(lx, ly, 2.5 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Expose coordinate system to game overlay
    const chartOffsetTop = containerRef.current?.offsetTop ?? 0;
    onFrameData?.({
      priceToY, timeToX,
      cometX: lx, cometY: ly, cometPrice: lastPt.price,
      minPrice, maxPrice, minTime, maxTime,
      chartW, chartH, padding, isWinning: !!isWinning,
      chartOffsetTop,
    });

    animFrameRef.current = requestAnimationFrame(drawChart);
  }, [activeBet]);

  /* ── Start Animation Loop ── */
  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(drawChart);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [drawChart]);

  /* ── Format countdown ── */
  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const priceChange = activeBet ? currentPrice - activeBet.entryPrice : 0;
  const priceChangePct = activeBet ? (priceChange / activeBet.entryPrice) * 100 : 0;
  const isWinningState = activeBet
    ? activeBet.side === "UP"
      ? currentPrice > activeBet.entryPrice
      : currentPrice < activeBet.entryPrice
    : false;

  const potentialWin = activeBet ? activeBet.shares * (1 - activeBet.entryPrice) * 0.9 : 0;
  const potentialLoss = activeBet ? activeBet.amount : 0;

  return (
    <div className="ep-card overflow-hidden border border-accent/10">
      {/* ── Header Bar ── */}
      <div className="p-4 border-b border-ep-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? "bg-profit animate-live-dot" : "bg-loss"}`} />
            <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">
              {activeBet ? "LIVE RACE" : "SPECTATING"}
            </span>
          </div>
          {activeBet && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
              activeBet.side === "UP"
                ? "bg-profit/10 text-profit border border-profit/20"
                : "bg-loss/10 text-loss border border-loss/20"
            }`}>
              {activeBet.side} ${activeBet.amount.toFixed(2)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* Current price */}
          <div className="text-right">
            <p className="text-xs text-text-muted">{asset === "ethusdt" ? "ETH" : "BTC"}</p>
            <p className="text-sm font-mono font-bold text-text-primary">
              ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          {/* Countdown */}
          {activeBet && timeRemaining > 0 && (
            <div className={`text-right px-3 py-1.5 rounded-lg ${
              timeRemaining < 30
                ? "bg-loss/10 border border-loss/20"
                : "bg-ep-surface border border-ep-border"
            }`}>
              <p className="text-[10px] text-text-muted">Remaining</p>
              <p className={`text-sm font-mono font-bold ${
                timeRemaining < 30 ? "text-loss" : "text-accent"
              }`}>
                {formatCountdown(timeRemaining)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Chart Area ── */}
      <div ref={containerRef} className="relative h-[350px] sm:h-[400px]">
        <canvas ref={canvasRef} className="absolute inset-0" />

        {/* Side banners */}
        {activeBet && (
          <>
            <div className={`absolute top-4 left-4 px-3 py-1.5 rounded-lg text-xs font-bold ${
              activeBet.side === "UP"
                ? "bg-profit/10 text-profit border border-profit/20 animate-glow-pulse"
                : "bg-ep-surface/80 text-text-muted border border-ep-border"
            }`}>
              UP {activeBet.side === "UP" ? "📈" : ""}
            </div>
            <div className={`absolute bottom-12 left-4 px-3 py-1.5 rounded-lg text-xs font-bold ${
              activeBet.side === "DOWN"
                ? "bg-loss/10 text-loss border border-loss/20 animate-glow-pulse"
                : "bg-ep-surface/80 text-text-muted border border-ep-border"
            }`}>
              DOWN {activeBet.side === "DOWN" ? "📉" : ""}
            </div>
          </>
        )}

        {/* P&L overlay */}
        {activeBet && currentPrice > 0 && (
          <div className={`absolute top-4 right-4 px-3 py-2 rounded-lg border ${
            isWinningState
              ? "bg-profit/5 border-profit/20"
              : "bg-loss/5 border-loss/20"
          }`}>
            <p className={`text-lg font-mono font-bold ${isWinningState ? "text-profit" : "text-loss"}`}>
              {priceChange >= 0 ? "+" : ""}{priceChangePct.toFixed(3)}%
            </p>
            <p className="text-[10px] text-text-muted">
              Win: <span className="text-profit">+${potentialWin.toFixed(2)}</span>
              {" / "}
              Lose: <span className="text-loss">-${potentialLoss.toFixed(2)}</span>
            </p>
          </div>
        )}

        {/* Race result overlay */}
        <AnimatePresence>
          {raceResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex items-center justify-center z-10"
            >
              <div className={`px-8 py-6 rounded-2xl text-center ${
                raceResult === "won"
                  ? "bg-profit/10 border-2 border-profit/30 shadow-glow"
                  : "bg-loss/10 border-2 border-loss/30"
              }`}>
                <p className="text-4xl mb-2">{raceResult === "won" ? "🎉" : "😔"}</p>
                <p className={`text-2xl font-display font-bold ${
                  raceResult === "won" ? "text-profit" : "text-loss"
                }`}>
                  {raceResult === "won" ? "WIN!" : "LOSS"}
                </p>
                <p className={`text-sm font-mono mt-1 ${
                  raceResult === "won" ? "text-profit" : "text-loss"
                }`}>
                  {raceResult === "won" ? `+$${potentialWin.toFixed(2)}` : `-$${potentialLoss.toFixed(2)}`}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* No data state */}
        {pricesRef.current.length < 2 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-text-muted">Connecting to price feed...</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Stats Bar ── */}
      {activeBet && (
        <div className="p-3 border-t border-ep-border bg-ep-surface/50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[10px] text-text-muted">Entry</p>
              <p className="text-xs font-mono text-text-primary">${activeBet.entryPrice.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-muted">Current</p>
              <p className={`text-xs font-mono ${isWinningState ? "text-profit" : "text-loss"}`}>
                ${currentPrice.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-text-muted">Bet</p>
              <p className="text-xs font-mono text-text-primary">${activeBet.amount.toFixed(2)}</p>
            </div>
          </div>
          <div className={`text-xs font-bold ${isWinningState ? "text-profit" : "text-loss"}`}>
            {isWinningState ? "WINNING" : "LOSING"}
          </div>
        </div>
      )}
    </div>
  );
}
