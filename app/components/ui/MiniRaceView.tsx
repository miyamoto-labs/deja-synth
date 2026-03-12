'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { PricePoint } from '@/app/lib/hooks/useBinancePrice';
import type { FrameData } from './snake-game/types';

/* ── Types ──────────────────────────────────────── */
interface ActiveBet {
  side: 'UP' | 'DOWN';
  entryPrice: number;
  amount: number;
  shares: number;
  market: string;
  marketEndTime: number;
}

interface MiniRaceViewProps {
  pricesRef: React.MutableRefObject<PricePoint[]>;
  latestPriceRef: React.MutableRefObject<{ price: number; time: number }>;
  smoothPriceRef: React.MutableRefObject<{ price: number; time: number }>;
  currentPrice: number;
  connected: boolean;
  activeBet: ActiveBet | null;
  onFrameData?: (data: FrameData) => void;
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

/* ── Component ─────────────────────────────────── */
export function MiniRaceView({
  pricesRef,
  latestPriceRef,
  smoothPriceRef,
  currentPrice,
  connected,
  activeBet,
  onFrameData,
}: MiniRaceViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());
  const particlesRef = useRef<Particle[]>([]);

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const storedPrices = pricesRef.current;
    if (storedPrices.length < 2) {
      animFrameRef.current = requestAnimationFrame(drawChart);
      return;
    }

    // Smooth interpolation
    const live = latestPriceRef.current;
    const smooth = smoothPriceRef.current;
    if (live.price > 0) {
      if (smooth.price === 0) {
        smooth.price = live.price;
        smooth.time = live.time;
      } else {
        smooth.price += (live.price - smooth.price) * 0.15;
        smooth.time = Date.now();
      }
    }

    const prices: PricePoint[] = [...storedPrices];
    if (smooth.price > 0 && smooth.time > 0) {
      const lastStored = storedPrices[storedPrices.length - 1];
      if (smooth.time >= lastStored.time) {
        prices.push({ time: smooth.time, price: smooth.price });
      }
    }

    // Compact padding
    const padding = { top: 8, bottom: 8, left: 0, right: 50 };
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

    const minTime = prices[0].time;
    const maxTime = prices[prices.length - 1].time;
    const timeRange = maxTime - minTime || 1;

    const priceToY = (p: number) => padding.top + chartH * (1 - (p - minPrice) / priceRange);
    const timeToX = (t: number) => padding.left + chartW * ((t - minTime) / timeRange);

    // Grid lines (fewer for compact)
    ctx.strokeStyle = 'rgba(30, 34, 53, 0.5)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 2; i++) {
      const y = padding.top + (chartH / 2) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      const labelPrice = maxPrice - (priceRange / 2) * i;
      ctx.fillStyle = '#505672';
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.textAlign = 'left';
      ctx.fillText(`$${labelPrice.toFixed(0)}`, w - padding.right + 4, y + 3);
    }

    // Entry price dashed line
    if (activeBet && entryPrice > 0) {
      const entryY = priceToY(entryPrice);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padding.left, entryY);
      ctx.lineTo(w - padding.right, entryY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const lastPt = prices[prices.length - 1];
    const lx = timeToX(lastPt.time);
    const ly = priceToY(lastPt.price);

    const isWinning =
      activeBet && entryPrice > 0
        ? activeBet.side === 'UP'
          ? lastPt.price > entryPrice
          : lastPt.price < entryPrice
        : true;

    const glowColor = isWinning ? '0, 240, 160' : '255, 64, 96';
    const lineColor = isWinning ? '#00F0A0' : '#FF4060';

    // Ambient glow wash (smaller for compact)
    const washRadius = chartW * 0.2;
    const wash = ctx.createRadialGradient(lx, ly, 0, lx, ly, washRadius);
    wash.addColorStop(0, `rgba(${glowColor}, 0.03)`);
    wash.addColorStop(1, `rgba(${glowColor}, 0)`);
    ctx.fillStyle = wash;
    ctx.beginPath();
    ctx.arc(lx, ly, washRadius, 0, Math.PI * 2);
    ctx.fill();

    // Fill area between entry and price
    if (activeBet && entryPrice > 0 && prices.length > 2) {
      const entryY = priceToY(entryPrice);
      ctx.globalAlpha = 0.06;
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

    // Price line with Bezier smoothing + comet fade
    if (prices.length >= 2) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const totalPts = prices.length;

      for (let i = 1; i < totalPts; i++) {
        const x0 = timeToX(prices[i - 1].time);
        const y0 = priceToY(prices[i - 1].price);
        const x1 = timeToX(prices[i].time);
        const y1 = priceToY(prices[i].price);

        const progress = i / (totalPts - 1);
        const alpha = Math.max(0.05, Math.pow(progress, 2.5));
        const lw = 0.8 + 1.5 * progress; // Slightly thinner for compact

        let color: string;
        if (activeBet && entryPrice > 0) {
          const aboveEntry = prices[i].price > entryPrice;
          const segWinning = activeBet.side === 'UP' ? aboveEntry : !aboveEntry;
          color = segWinning ? '#00F0A0' : '#FF4060';
        } else {
          color = '#00F0A0';
        }

        ctx.globalAlpha = alpha;
        ctx.lineWidth = lw;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(x0, y0);

        const pPrev = i >= 2
          ? { x: timeToX(prices[i - 2].time), y: priceToY(prices[i - 2].price) }
          : { x: x0, y: y0 };
        const pNext = i < totalPts - 1
          ? { x: timeToX(prices[i + 1].time), y: priceToY(prices[i + 1].price) }
          : { x: x1, y: y1 };

        const { cp1, cp2 } = catmullRomToBezier(pPrev, { x: x0, y: y0 }, { x: x1, y: y1 }, pNext, 0.3);
        ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, x1, y1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Sparkle particles (fewer for compact)
    particlesRef.current.push({
      x: lx, y: ly,
      vx: -0.4 - Math.random() * 1.0,
      vy: (Math.random() - 0.5) * 0.8,
      life: 1.0,
      size: 0.4 + Math.random() * 1.0,
      brightness: 0.3 + Math.random() * 0.4,
    });

    particlesRef.current = particlesRef.current.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.025;
      p.vy += 0.008;
      return p.life > 0;
    });

    for (const p of particlesRef.current) {
      const a = p.life * p.brightness;
      ctx.fillStyle = `rgba(${glowColor}, ${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }

    // Comet head (scaled down for compact)
    const elapsed = Date.now() - startTimeRef.current;
    const pulse = 1 + 0.12 * Math.sin((elapsed / 1500) * Math.PI * 2);

    // Core glow
    const coreGlowRadius = 18;
    const coreGlow = ctx.createRadialGradient(lx, ly, 0, lx, ly, coreGlowRadius);
    coreGlow.addColorStop(0, `rgba(${glowColor}, 0.5)`);
    coreGlow.addColorStop(0.4, `rgba(${glowColor}, 0.15)`);
    coreGlow.addColorStop(1, `rgba(${glowColor}, 0)`);
    ctx.fillStyle = coreGlow;
    ctx.beginPath();
    ctx.arc(lx, ly, coreGlowRadius, 0, Math.PI * 2);
    ctx.fill();

    // White-hot bloom
    const whiteGlow = ctx.createRadialGradient(lx, ly, 0, lx, ly, 8);
    whiteGlow.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
    whiteGlow.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
    whiteGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = whiteGlow;
    ctx.beginPath();
    ctx.arc(lx, ly, 8, 0, Math.PI * 2);
    ctx.fill();

    // Colored dot
    const dotRadius = 3.5 * pulse;
    ctx.fillStyle = lineColor;
    ctx.beginPath();
    ctx.arc(lx, ly, dotRadius, 0, Math.PI * 2);
    ctx.fill();

    // White core
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(lx, ly, 2 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Expose frame data for snake game
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

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(drawChart);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [drawChart]);

  return (
    <div ref={containerRef} className="relative h-[180px] sm:h-[240px]">
      <canvas ref={canvasRef} className="absolute inset-0" />
      {pricesRef.current.length < 2 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-1">
            <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto" />
            <p className="text-[9px] text-text-muted">Connecting...</p>
          </div>
        </div>
      )}
    </div>
  );
}
