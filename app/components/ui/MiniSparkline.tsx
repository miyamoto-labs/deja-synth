'use client';

import { useMemo } from 'react';

interface PricePoint {
  t: number;
  p: number;
}

interface MiniSparklineProps {
  data: PricePoint[];
  height?: number;
  className?: string;
}

const COLOR_UP = '#00F0A0';
const COLOR_DOWN = '#FF4060';

/**
 * Tiny inline sparkline rendered as pure SVG.
 * Zero dependencies, renders 50+ instances without lag.
 */
export function MiniSparkline({ data, height = 32, className = '' }: MiniSparklineProps) {
  const svgContent = useMemo(() => {
    if (!data || data.length < 2) return null;

    const prices = data.map((d) => d.p);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 0.001; // avoid division by zero for flat lines

    const isUp = prices[prices.length - 1] >= prices[0];
    const color = isUp ? COLOR_UP : COLOR_DOWN;

    // Normalize to SVG coordinate space
    // Use a viewBox of 100 x height, with 2px padding top/bottom for stroke
    const pad = 2;
    const plotH = height - pad * 2;
    const stepX = 100 / (prices.length - 1);

    const points = prices.map((p, i) => {
      const x = i * stepX;
      const y = pad + plotH - ((p - min) / range) * plotH;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });

    const polylinePoints = points.join(' ');

    // Build the filled area path (line + close to bottom-right → bottom-left)
    const fillPoints = [
      ...points,
      `100,${height}`, // bottom-right
      `0,${height}`,   // bottom-left
    ].join(' ');

    // Unique ID for gradient (avoid collisions with multiple sparklines)
    const gradId = `sp-${Math.random().toString(36).slice(2, 8)}`;

    return { polylinePoints, fillPoints, color, gradId };
  }, [data, height]);

  if (!svgContent) return null;

  const { polylinePoints, fillPoints, color, gradId } = svgContent;

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className={`w-full ${className}`}
      style={{ height }}
      role="img"
      aria-label="Price trend sparkline"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.15} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Filled area */}
      <polygon
        points={fillPoints}
        fill={`url(#${gradId})`}
      />

      {/* Price line */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Skeleton placeholder matching the sparkline's reserved height. */
export function MiniSparklineSkeleton({ height = 32 }: { height?: number }) {
  return (
    <div
      className="w-full rounded bg-ep-surface/40 animate-pulse"
      style={{ height }}
    />
  );
}
