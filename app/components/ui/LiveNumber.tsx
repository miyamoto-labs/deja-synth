'use client';

import { useEffect, useRef, useState } from 'react';

interface LiveNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  colorize?: boolean; // green for positive, red for negative
  animate?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function LiveNumber({
  value,
  prefix = '',
  suffix = '',
  decimals = 2,
  className = '',
  colorize = false,
  animate = true,
  size = 'md',
}: LiveNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);
  const prevValue = useRef(value);

  useEffect(() => {
    if (!animate) {
      setDisplayValue(value);
      return;
    }

    const prev = prevValue.current;
    prevValue.current = value;

    if (prev === value) return;

    setDirection(value > prev ? 'up' : 'down');

    // Animate from previous to new value
    const duration = 600;
    const steps = 20;
    const increment = (value - prev) / steps;
    let current = prev;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current += increment;
      if (step >= steps) {
        setDisplayValue(value);
        clearInterval(timer);
        setTimeout(() => setDirection(null), 400);
      } else {
        setDisplayValue(current);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value, animate]);

  const sizeClasses = {
    sm: 'text-stat-sm',
    md: 'text-stat-md',
    lg: 'text-stat-lg',
    xl: 'text-stat-xl',
  };

  const colorClass = colorize
    ? value > 0
      ? 'text-profit'
      : value < 0
      ? 'text-loss'
      : 'text-text-secondary'
    : '';

  const directionClass = direction === 'up'
    ? 'animate-tick-up'
    : direction === 'down'
    ? 'animate-tick-down'
    : '';

  // Format with abbreviation for large numbers
  const formatLarge = (val: number) => {
    const abs = Math.abs(val);
    if (abs >= 1_000_000_000) return (val / 1_000_000_000).toFixed(1) + 'B';
    if (abs >= 1_000_000) return (val / 1_000_000).toFixed(1) + 'M';
    if (abs >= 100_000) return (val / 1_000).toFixed(0) + 'K';
    if (abs >= 10_000) return (val / 1_000).toFixed(1) + 'K';
    return val.toFixed(decimals);
  };

  const formatted = Math.abs(displayValue) >= 10_000
    ? formatLarge(displayValue)
    : displayValue.toFixed(decimals);

  return (
    <span
      className={`font-mono tabular-nums ${sizeClasses[size]} ${colorClass} ${directionClass} ${className}`}
    >
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
