"use client";

import React from "react";
import { DocsCallout } from "../components/DocsCallout";
import { CodeBlock } from "../components/CodeBlock";
import type { TOCItem } from "../components/DocsTOC";

export const traderDiscoveryTOC: TOCItem[] = [
  { id: "copy-trading", title: "What is Copy Trading?", level: 2 },
  { id: "trader-tiers", title: "Tier System", level: 2 },
  { id: "scoring-algorithm", title: "7-Factor Scoring Algorithm", level: 2 },
  { id: "follow-trader", title: "How to Follow a Trader", level: 2 },
  { id: "trader-categories", title: "Categories", level: 2 },
];

export function TraderDiscoveryContent() {
  return (
    <div className="docs-content">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-text-primary mb-3">
          Trader Discovery
        </h1>
        <p className="text-lg text-text-secondary leading-relaxed">
          Find the best Polymarket traders, understand their strategies, and learn from the pros.
        </p>
      </div>

      {/* What is Copy Trading */}
      <section id="copy-trading" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> What is Copy Trading?
        </h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          Copy trading lets you follow the moves of successful traders. Instead of doing all the research yourself, you can see what the best traders are buying and use their positions as a signal.
        </p>
        <p className="text-text-secondary leading-relaxed mb-4">
          On Déjà, trader discovery works like this:
        </p>
        <ul className="space-y-2 mb-4 text-sm text-text-secondary">
          <li className="flex items-start gap-2">
            <span className="text-accent">→</span>
            We scan all on-chain Polymarket activity
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent">→</span>
            We identify wallets with consistent, profitable track records
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent">→</span>
            We rank them using our 7-factor algorithm (not just PnL!)
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent">→</span>
            You can browse traders, see their current positions, and follow their activity
          </li>
        </ul>

        <DocsCallout type="info">
          Déjà currently supports &ldquo;signal-based&rdquo; copy trading — we show you what top traders are doing, but you place trades yourself. Automated copy trading (auto-mirroring positions) is on our roadmap.
        </DocsCallout>
      </section>

      {/* Tier System */}
      <section id="trader-tiers" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> Trader Tier System
        </h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          Every qualified trader gets a tier badge based on their composite score:
        </p>

        <div className="space-y-3 mb-4">
          {[
            { tier: "S", icon: "🔥", name: "Elite", range: "90-100", color: "text-red-400", border: "border-red-500/20 bg-red-500/5", desc: "Consistently profitable with high win rate, excellent risk management, and proven edge. These are the whales and pros." },
            { tier: "A", icon: "💎", name: "Strong", range: "75-89", color: "text-blue-400", border: "border-blue-500/20 bg-blue-500/5", desc: "Solid performers with good returns and consistency. Reliable signals, occasional variance." },
            { tier: "B", icon: "⚡", name: "Decent", range: "60-74", color: "text-yellow-400", border: "border-yellow-500/20 bg-yellow-500/5", desc: "Above average traders. Positive expected value but more inconsistent. Good for diversification." },
            { tier: "C", icon: "📊", name: "Marginal", range: "40-59", color: "text-gray-400", border: "border-gray-500/20 bg-gray-500/5", desc: "Break-even to slightly positive. Could be skilled but unproven, or experienced a drawdown." },
            { tier: "D", icon: "⬇️", name: "Weak", range: "0-39", color: "text-gray-600", border: "border-gray-500/10 bg-gray-500/3", desc: "Below average performance. Negative edge or insufficient track record. Proceed with caution." },
          ].map((item) => (
            <div key={item.tier} className={`flex items-start gap-4 rounded-xl border ${item.border} p-4`}>
              <div className="text-2xl w-8 flex-shrink-0 text-center">{item.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-bold ${item.color}`}>Tier {item.tier}</span>
                  <span className="text-xs text-text-muted">• {item.name}</span>
                  <span className="text-xs text-text-muted font-mono">({item.range})</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 7-Factor Scoring Algorithm */}
      <section id="scoring-algorithm" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> 7-Factor Scoring Algorithm
        </h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          We don&apos;t just rank traders by profit. Our algorithm uses seven weighted factors to find genuinely skilled traders:
        </p>

        <CodeBlock language="formula" title="Trader Composite Score">
{`Trader Score = 
  (25% × ROI Score)
+ (20% × Win Rate Score)
+ (15% × Consistency Score)
+ (15% × Risk Management Score)
+ (10% × Volume Score)
+ (10% × Edge Score)
+ (5%  × Recency Score)`}
        </CodeBlock>

        <div className="space-y-4 mb-6">
          {[
            { factor: "ROI", weight: "25%", icon: "📈", desc: "Return on investment across all resolved positions. Normalized by time period to compare fairly across different trading histories." },
            { factor: "Win Rate", weight: "20%", icon: "🎯", desc: "Percentage of positions that resolved profitably. A 65%+ win rate is strong in prediction markets." },
            { factor: "Consistency", weight: "15%", icon: "📊", desc: "How steady are the returns? A trader who makes 5% every week beats one who gains 50% then loses 40%. Measured by Sharpe-like ratio on rolling windows." },
            { factor: "Risk Management", weight: "15%", icon: "🛡️", desc: "Position sizing discipline. Traders who size appropriately (not all-in, not negligibly small) and diversify across markets score higher. Max drawdown is penalized." },
            { factor: "Volume", weight: "10%", icon: "💰", desc: "Total trading volume in USDC. Minimum $500 to qualify. Higher volume = more data points = more confidence in the score." },
            { factor: "Edge", weight: "10%", icon: "🔍", desc: "Are they buying at good prices? Measures average entry price vs. resolution outcome. Skilled traders consistently find mispriced markets." },
            { factor: "Recency", weight: "5%", icon: "⏱️", desc: "Recent performance matters more. A trader crushing it this month is more relevant than one who peaked 6 months ago." },
          ].map((item) => (
            <div key={item.factor} className="flex items-start gap-4 rounded-lg bg-ep-card/30 border border-ep-border/50 p-4">
              <div className="text-xl flex-shrink-0">{item.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-text-primary">{item.factor}</span>
                  <span className="text-xs text-accent font-mono bg-accent/5 px-1.5 py-0.5 rounded">{item.weight}</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How to Follow */}
      <section id="follow-trader" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> How to Follow a Trader
        </h2>

        <div className="space-y-4 mb-6">
          {[
            { step: "1", title: "Browse the Traders page", desc: "Sort by tier, category, or specific metrics like ROI or win rate." },
            { step: "2", title: "Click on a trader card", desc: "See their full profile: trade history, open positions, category specialization, and score breakdown." },
            { step: "3", title: "Review their current positions", desc: "Check what they're betting on right now. Do their positions align with your views?" },
            { step: "4", title: "Shadow their trades", desc: "When you see a position you like, click through to Polymarket and take a similar position." },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-sm font-bold text-accent">
                {item.step}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-text-primary">{item.title}</h4>
                <p className="text-sm text-text-secondary mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <DocsCallout type="warning">
          Never blindly copy a trader. Even S-tier traders can be wrong. Use their positions as one input in your decision-making, not the only input.
        </DocsCallout>
      </section>

      {/* Categories */}
      <section id="trader-categories" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> Trader Categories
        </h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          Many traders specialize. Our algorithm detects what category a trader performs best in based on their historical trades:
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { name: "Politics", icon: "🏛️", desc: "Elections, policy, government" },
            { name: "Sports", icon: "⚽", desc: "Games, player props, tournaments" },
            { name: "Crypto", icon: "₿", desc: "Prices, protocol events, DeFi" },
            { name: "Culture", icon: "🎬", desc: "Entertainment, viral moments" },
            { name: "Finance", icon: "💹", desc: "Macro, Fed, earnings" },
            { name: "Generalist", icon: "🌐", desc: "Multi-category specialists" },
          ].map((cat) => (
            <div key={cat.name} className="rounded-xl border border-ep-border bg-ep-card/30 p-4">
              <div className="text-2xl mb-2">{cat.icon}</div>
              <div className="text-sm font-semibold text-text-primary">{cat.name}</div>
              <div className="text-xs text-text-muted mt-1">{cat.desc}</div>
            </div>
          ))}
        </div>

        <DocsCallout type="tip">
          Filter traders by category to find specialists. A Sports-focused S-tier trader may give better signals on a Super Bowl market than a generalist A-tier trader.
        </DocsCallout>
      </section>
    </div>
  );
}
