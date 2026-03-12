"use client";

import { useEffect, useState } from "react";

interface Metrics {
  total_return: number;
  total_return_pct: number;
  win_rate: number;
  sharpe_ratio: number;
  max_drawdown: number;
  max_drawdown_pct: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  avg_win: number;
  avg_loss: number;
  largest_win: number;
  largest_loss: number;
  profit_factor: number;
}

interface MetricsCardsProps {
  metrics: Metrics;
}

function AnimatedNumber({ value, prefix = "", suffix = "", decimals = 0 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 1000; // 1 second
    const increment = (end - start) / (duration / 16); // 60fps

    let current = start;
    const timer = setInterval(() => {
      current += increment;
      if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(current);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <span>
      {prefix}
      {displayValue.toFixed(decimals)}
      {suffix}
    </span>
  );
}

export function MetricsCards({ metrics }: MetricsCardsProps) {
  const primaryMetrics = [
    {
      label: "Total Return",
      value: metrics.total_return,
      display: <AnimatedNumber value={metrics.total_return} prefix="$" decimals={2} />,
      color: metrics.total_return >= 0 ? "text-green-400" : "text-red-400",
      bg: metrics.total_return >= 0 ? "bg-green-500/10" : "bg-red-500/10",
      border: metrics.total_return >= 0 ? "border-green-500/20" : "border-red-500/20",
    },
    {
      label: "Return %",
      value: metrics.total_return_pct,
      display: <AnimatedNumber value={metrics.total_return_pct} suffix="%" decimals={2} />,
      color: metrics.total_return_pct >= 0 ? "text-green-400" : "text-red-400",
      bg: metrics.total_return_pct >= 0 ? "bg-green-500/10" : "bg-red-500/10",
      border: metrics.total_return_pct >= 0 ? "border-green-500/20" : "border-red-500/20",
    },
    {
      label: "Win Rate",
      value: metrics.win_rate,
      display: <AnimatedNumber value={metrics.win_rate} suffix="%" decimals={1} />,
      color: metrics.win_rate >= 55 ? "text-green-400" : metrics.win_rate >= 50 ? "text-yellow-400" : "text-red-400",
      bg: metrics.win_rate >= 55 ? "bg-green-500/10" : metrics.win_rate >= 50 ? "bg-yellow-500/10" : "bg-red-500/10",
      border: metrics.win_rate >= 55 ? "border-green-500/20" : metrics.win_rate >= 50 ? "border-yellow-500/20" : "border-red-500/20",
    },
    {
      label: "Sharpe Ratio",
      value: metrics.sharpe_ratio,
      display: <AnimatedNumber value={metrics.sharpe_ratio} decimals={2} />,
      color: metrics.sharpe_ratio >= 1 ? "text-green-400" : metrics.sharpe_ratio >= 0 ? "text-yellow-400" : "text-red-400",
      bg: metrics.sharpe_ratio >= 1 ? "bg-green-500/10" : metrics.sharpe_ratio >= 0 ? "bg-yellow-500/10" : "bg-red-500/10",
      border: metrics.sharpe_ratio >= 1 ? "border-green-500/20" : metrics.sharpe_ratio >= 0 ? "border-yellow-500/20" : "border-red-500/20",
    },
  ];

  const secondaryMetrics = [
    {
      label: "Max Drawdown",
      value: `$${metrics.max_drawdown.toFixed(2)} (${metrics.max_drawdown_pct.toFixed(1)}%)`,
    },
    {
      label: "Total Trades",
      value: metrics.total_trades,
    },
    {
      label: "Winning Trades",
      value: metrics.winning_trades,
    },
    {
      label: "Losing Trades",
      value: metrics.losing_trades,
    },
    {
      label: "Avg Win",
      value: `$${metrics.avg_win.toFixed(2)}`,
    },
    {
      label: "Avg Loss",
      value: `$${metrics.avg_loss.toFixed(2)}`,
    },
    {
      label: "Largest Win",
      value: `$${metrics.largest_win.toFixed(2)}`,
    },
    {
      label: "Largest Loss",
      value: `$${metrics.largest_loss.toFixed(2)}`,
    },
    {
      label: "Profit Factor",
      value: metrics.profit_factor.toFixed(2),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Primary Metrics - Large Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {primaryMetrics.map((metric) => (
          <div
            key={metric.label}
            className={`${metric.bg} border ${metric.border} rounded-lg p-6 transition-all hover:scale-[1.02]`}
          >
            <p className="text-sm text-text-muted mb-2">{metric.label}</p>
            <p className={`text-3xl font-bold ${metric.color}`}>{metric.display}</p>
          </div>
        ))}
      </div>

      {/* Secondary Metrics - Compact Grid */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">Detailed Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {secondaryMetrics.map((metric) => (
            <div key={metric.label}>
              <p className="text-text-muted">{metric.label}</p>
              <p className="font-medium text-foreground">{metric.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
