'use client';

import { useRef, useEffect } from 'react';

interface Trade {
  id: string;
  side: string;
  amount: number;
  price: number;
  created_at: string;
}

interface CumulativePnLProps {
  trades: Trade[];
}

interface DataPoint {
  time: string;
  value: number;
}

function buildCumulativePnL(trades: Trade[]): DataPoint[] {
  // Sort chronologically (oldest first)
  const sorted = [...trades].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  let cumulative = 0;
  const dayMap = new Map<string, number>();

  for (const t of sorted) {
    const amount = Number(t.amount) || 0;

    // Track cash flow: BUY = money out, SELL = money in
    if (t.side === 'BUY') {
      cumulative -= amount;
    } else {
      cumulative += amount;
    }

    // Keep last value per day (lightweight-charts requires unique timestamps)
    const day = new Date(t.created_at).toISOString().slice(0, 10);
    dayMap.set(day, Math.round(cumulative * 100) / 100);
  }

  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, value]) => ({ time, value }));
}

export function CumulativePnL({ trades }: CumulativePnLProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || trades.length === 0) return;

    const data = buildCumulativePnL(trades);
    if (data.length < 2) return;

    let chart: any = null;
    let observer: ResizeObserver | null = null;

    // Dynamic import to avoid SSR issues
    import('lightweight-charts').then(
      ({ createChart, ColorType, LineStyle }) => {
        if (!containerRef.current) return;

        chart = createChart(containerRef.current, {
          layout: {
            background: { type: ColorType.Solid, color: 'transparent' },
            textColor: '#505672',
            fontFamily: "'General Sans', system-ui, sans-serif",
            fontSize: 11,
          },
          grid: {
            vertLines: { color: 'rgba(30, 34, 53, 0.5)' },
            horzLines: { color: 'rgba(30, 34, 53, 0.5)' },
          },
          width: containerRef.current.clientWidth,
          height: 240,
          rightPriceScale: {
            borderColor: '#1E2235',
            scaleMargins: { top: 0.12, bottom: 0.12 },
          },
          timeScale: {
            borderColor: '#1E2235',
            timeVisible: false,
          },
          crosshair: {
            vertLine: {
              color: 'rgba(0, 240, 160, 0.3)',
              style: LineStyle.Dashed,
              labelBackgroundColor: '#151823',
            },
            horzLine: {
              color: 'rgba(0, 240, 160, 0.3)',
              style: LineStyle.Dashed,
              labelBackgroundColor: '#151823',
            },
          },
          handleScroll: false,
          handleScale: false,
        });

        // Use baseline series: green above zero, red below
        const series = chart.addBaselineSeries({
          topFillColor1: 'rgba(0, 240, 160, 0.25)',
          topFillColor2: 'rgba(0, 240, 160, 0.02)',
          topLineColor: '#00F0A0',
          bottomFillColor1: 'rgba(255, 64, 96, 0.02)',
          bottomFillColor2: 'rgba(255, 64, 96, 0.25)',
          bottomLineColor: '#FF4060',
          baseValue: { type: 'price' as const, price: 0 },
          lineWidth: 2,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 4,
          crosshairMarkerBackgroundColor: '#00F0A0',
          crosshairMarkerBorderColor: '#08090E',
          priceFormat: {
            type: 'custom' as const,
            formatter: (price: number) =>
              `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
          },
        });

        series.setData(data);
        chart.timeScale().fitContent();
        chartRef.current = chart;

        // Responsive resize
        observer = new ResizeObserver(() => {
          if (containerRef.current && chart) {
            chart.applyOptions({ width: containerRef.current.clientWidth });
          }
        });
        observer.observe(containerRef.current);
      }
    );

    return () => {
      observer?.disconnect();
      if (chart) {
        chart.remove();
        chartRef.current = null;
      }
    };
  }, [trades]);

  if (trades.length < 2) {
    return (
      <div className="flex items-center justify-center h-[240px] text-sm text-text-muted">
        Need at least 2 trades for chart
      </div>
    );
  }

  return <div ref={containerRef} className="w-full" />;
}
