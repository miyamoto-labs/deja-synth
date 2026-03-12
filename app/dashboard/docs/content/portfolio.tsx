"use client";

import React from "react";
import { DocsCallout } from "../components/DocsCallout";
import type { TOCItem } from "../components/DocsTOC";

export const portfolioTOC: TOCItem[] = [
  { id: "track-bets", title: "Track Your Bets", level: 2 },
  { id: "win-loss-stats", title: "Win/Loss Statistics", level: 2 },
  { id: "performance-time", title: "Performance Over Time", level: 2 },
];

export function PortfolioContent() {
  return (
    <div className="docs-content">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-text-primary mb-3">
          Portfolio
        </h1>
        <p className="text-lg text-text-secondary leading-relaxed">
          Track your bets, monitor performance, and understand your trading patterns.
        </p>
      </div>

      {/* Track Your Bets */}
      <section id="track-bets" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> Track Your Bets
        </h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          The Portfolio page gives you a real-time view of all your Polymarket positions. Once your wallet is connected, we automatically sync and display:
        </p>

        <div className="grid gap-3 sm:grid-cols-2 mb-6">
          {[
            { icon: "📂", title: "Open Positions", desc: "Active bets that haven't resolved yet. Shows current value, unrealized P&L, and market status." },
            { icon: "✅", title: "Resolved Positions", desc: "Completed trades with final outcomes. Won or lost — it's all here." },
            { icon: "💰", title: "Total Value", desc: "Sum of all your position values at current market prices." },
            { icon: "📊", title: "Cost Basis", desc: "How much you originally paid. Compare with current value to see unrealized gains/losses." },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-ep-border bg-ep-card/50 p-4">
              <div className="text-xl mb-2">{item.icon}</div>
              <div className="text-sm font-semibold text-text-primary mb-1">{item.title}</div>
              <div className="text-xs text-text-secondary leading-relaxed">{item.desc}</div>
            </div>
          ))}
        </div>

        <DocsCallout type="info">
          Portfolio data is read directly from on-chain activity linked to your wallet. We never access or control your funds.
        </DocsCallout>
      </section>

      {/* Win/Loss Statistics */}
      <section id="win-loss-stats" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> Win/Loss Statistics
        </h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          Once you have resolved positions, the Stats tab shows your performance metrics:
        </p>

        <div className="rounded-xl border border-ep-border bg-ep-card/50 p-5 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              { label: "Win Rate", value: "64%", color: "text-accent" },
              { label: "Total Trades", value: "47", color: "text-text-primary" },
              { label: "Net P&L", value: "+$312", color: "text-accent" },
              { label: "Avg Return", value: "+14%", color: "text-accent" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-text-muted mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-text-muted text-center mt-3 pt-3 border-t border-ep-border">
            Example stats — yours will reflect your actual trading history
          </div>
        </div>

        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          Key metrics explained:
        </p>
        <ul className="space-y-2 mb-4 text-sm text-text-secondary">
          <li className="flex items-start gap-2">
            <span className="text-accent font-bold">Win Rate</span> — Percentage of resolved positions that ended in profit
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent font-bold">Net P&L</span> — Total profit or loss across all resolved trades (in USDC)
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent font-bold">Avg Return</span> — Average percentage return per trade
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent font-bold">Best/Worst</span> — Your highest single gain and biggest single loss
          </li>
        </ul>
      </section>

      {/* Performance Over Time */}
      <section id="performance-time" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> Performance Over Time
        </h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          The performance chart shows your cumulative P&L over time. This helps you spot trends in your trading:
        </p>

        <ul className="space-y-2 mb-4 text-sm text-text-secondary">
          <li className="flex items-start gap-2">
            <span className="text-accent">→</span>
            <span><strong className="text-text-primary">Upward trend</strong> — Your strategy is working. Keep going.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent">→</span>
            <span><strong className="text-text-primary">Flat line</strong> — Breaking even. Consider adjusting your approach.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent">→</span>
            <span><strong className="text-text-primary">Downward trend</strong> — Take a step back. Review what&apos;s not working.</span>
          </li>
        </ul>

        {/* Placeholder chart */}
        <div className="rounded-xl border border-ep-border bg-ep-card/50 p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-text-primary">Cumulative P&L</span>
            <div className="flex gap-2">
              {["7D", "30D", "All"].map((period) => (
                <button key={period} className="px-2.5 py-1 text-xs rounded-md border border-ep-border text-text-muted hover:text-text-secondary hover:border-ep-border-bright transition">
                  {period}
                </button>
              ))}
            </div>
          </div>
          <div className="h-40 flex items-end justify-between gap-1">
            {/* Placeholder bars */}
            {[30, 45, 40, 60, 55, 70, 65, 80, 75, 90, 85, 95].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-accent/20 border-t-2 border-accent/60 transition-all"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div className="text-xs text-text-muted text-center mt-3">
            Chart visualization — actual data loads from your connected wallet
          </div>
        </div>

        <DocsCallout type="tip">
          Use the Stats page (separate from Portfolio) for deeper analytics including category breakdown, time-of-day analysis, and position sizing review.
        </DocsCallout>
      </section>
    </div>
  );
}
