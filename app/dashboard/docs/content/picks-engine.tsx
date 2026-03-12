"use client";

import React from "react";
import { DocsCallout } from "../components/DocsCallout";
import { CodeBlock } from "../components/CodeBlock";
import type { TOCItem } from "../components/DocsTOC";

export const picksEngineTOC: TOCItem[] = [
  { id: "daily-super-pick", title: "Daily Super Pick", level: 2 },
  { id: "category-filters", title: "Category Filters", level: 2 },
  { id: "wild-picks", title: "Wild Picks", level: 2 },
  { id: "scoring-system", title: "Scoring System", level: 2 },
  { id: "edge-score", title: "Edge Score", level: 3 },
  { id: "rr-score", title: "Risk/Reward Score", level: 3 },
  { id: "momentum-score", title: "Momentum Score", level: 3 },
  { id: "liquidity-score", title: "Liquidity Score", level: 3 },
  { id: "inefficiency-score", title: "Inefficiency Score", level: 3 },
  { id: "recency-score", title: "Recency Score", level: 3 },
];

export function PicksEngineContent() {
  return (
    <div className="docs-content">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-text-primary mb-3">
          Picks Engine
        </h1>
        <p className="text-lg text-text-secondary leading-relaxed">
          How our AI finds mispriced prediction markets — and presents them to you.
        </p>
      </div>

      {/* Daily Super Pick */}
      <section id="daily-super-pick" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> Daily Super Pick
        </h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          Every day, our algorithm selects the single highest-conviction pick across all markets. This is the <strong className="text-text-primary">Daily Super Pick</strong> — our best opportunity of the day.
        </p>
        <p className="text-text-secondary leading-relaxed mb-4">
          The Super Pick is chosen by:
        </p>
        <ul className="space-y-2 mb-4 text-sm text-text-secondary">
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">→</span>
            Ranking all active picks by composite score
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">→</span>
            Filtering for minimum liquidity ($50k+ volume)
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">→</span>
            Requiring a 10%+ edge (gap between market price and our fair value estimate)
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">→</span>
            Taking the top-scoring market that passes all thresholds
          </li>
        </ul>

        <div className="rounded-xl border border-accent/20 bg-accent/5 p-5 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">⭐</span>
            <span className="text-sm font-semibold text-accent uppercase tracking-wider">Daily Super Pick</span>
          </div>
          <p className="text-sm text-text-secondary">
            The Super Pick appears at the top of your Picks page with a distinctive gold border. It refreshes daily at 00:00 UTC.
          </p>
        </div>

        <DocsCallout type="tip">
          Historical Super Picks have had a 68% win rate. That said, past performance doesn&apos;t guarantee future results.
        </DocsCallout>
      </section>

      {/* Category Filters */}
      <section id="category-filters" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> Category Filters
        </h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          Polymarket covers a huge range of topics. Use category filters to focus on what you know best.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {[
            { name: "Politics", icon: "🏛️", desc: "Elections, legislation, geopolitics" },
            { name: "Sports", icon: "⚽", desc: "Games, tournaments, player markets" },
            { name: "Crypto", icon: "₿", desc: "Bitcoin, Ethereum, DeFi, token prices" },
            { name: "Culture", icon: "🎬", desc: "Entertainment, social media, awards" },
            { name: "Finance", icon: "💹", desc: "Fed rates, stocks, economic data" },
            { name: "Wild", icon: "🃏", desc: "Unpredictable, high-volatility markets" },
          ].map((cat) => (
            <div key={cat.name} className="rounded-xl border border-ep-border bg-ep-card/50 p-4 hover:border-ep-border-bright transition">
              <div className="text-2xl mb-2">{cat.icon}</div>
              <div className="text-sm font-semibold text-text-primary">{cat.name}</div>
              <div className="text-xs text-text-muted mt-1">{cat.desc}</div>
            </div>
          ))}
        </div>

        <DocsCallout type="info">
          Categories are assigned automatically based on market keywords and Polymarket tags. Some markets may appear in multiple categories.
        </DocsCallout>
      </section>

      {/* Wild Picks */}
      <section id="wild-picks" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> Wild Picks
        </h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          Wild Picks are markets with extreme risk/reward profiles. They typically have:
        </p>
        <ul className="space-y-2 mb-4 text-sm text-text-secondary">
          <li className="flex items-start gap-2">
            <span className="text-yellow-400 mt-0.5">⚡</span>
            Very low current prices (5¢-20¢) with potential for massive upside
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-400 mt-0.5">⚡</span>
            High volatility and uncertainty
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-400 mt-0.5">⚡</span>
            Catalysts that could swing the market rapidly
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-400 mt-0.5">⚡</span>
            Typically binary outcomes with asymmetric payoffs
          </li>
        </ul>

        <DocsCallout type="warning">
          Wild Picks are inherently risky. A 10¢ YES position that resolves NO means you lose your entire stake. Only allocate what you can afford to lose entirely. Treat these like lottery tickets — fun, but not your core strategy.
        </DocsCallout>

        <div className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5">
          <div className="text-xs text-yellow-400 uppercase tracking-wider font-semibold mb-2">Example Wild Pick</div>
          <p className="text-sm text-text-secondary">
            &ldquo;Will Elon Musk tweet about Dogecoin this week?&rdquo; — Currently at <span className="text-yellow-400 font-mono">12¢ YES</span>. 
            If you buy $10 worth and it resolves YES, you get ~$83. If No, you lose $10.
          </p>
        </div>
      </section>

      {/* Scoring System */}
      <section id="scoring-system" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> Scoring System
        </h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          Every pick gets a <strong className="text-text-primary">Composite Score</strong> from 0–100, calculated from six weighted factors:
        </p>

        <CodeBlock language="formula" title="Composite Score Formula">
{`Composite Score = 
  (25% × Edge Score)
+ (20% × Risk/Reward Score)
+ (15% × Momentum Score)
+ (15% × Liquidity Score)
+ (15% × Inefficiency Score)
+ (10% × Recency Score)`}
        </CodeBlock>

        {/* Edge Score */}
        <div id="edge-score" className="scroll-mt-24 mb-8">
          <h3 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-xs font-bold text-accent">1</span>
            Edge Score <span className="text-sm text-text-muted font-normal">(25% weight)</span>
          </h3>
          <p className="text-text-secondary text-sm leading-relaxed mb-3">
            The gap between the current market price and our estimated fair value. This is the core of what makes a pick valuable.
          </p>
          <div className="rounded-lg bg-ep-card/50 border border-ep-border p-4 text-sm">
            <span className="text-text-muted">Example: </span>
            <span className="text-text-secondary">
              Market says 60¢ YES, our model says fair value is 80¢. That&apos;s a <span className="text-accent font-semibold">+20¢ edge</span> — the market is underpricing this outcome.
            </span>
          </div>
        </div>

        {/* R/R Score */}
        <div id="rr-score" className="scroll-mt-24 mb-8">
          <h3 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-xs font-bold text-accent">2</span>
            Risk/Reward Score <span className="text-sm text-text-muted font-normal">(20% weight)</span>
          </h3>
          <p className="text-text-secondary text-sm leading-relaxed mb-3">
            How much you stand to gain relative to how much you risk. Calculated as potential upside divided by potential downside.
          </p>
          <div className="rounded-lg bg-ep-card/50 border border-ep-border p-4 text-sm">
            <span className="text-text-muted">Example: </span>
            <span className="text-text-secondary">
              Buy YES at 20¢. If it resolves YES → you profit 80¢ per share. If No → you lose 20¢. R/R = <span className="text-accent font-semibold">4:1</span>.
            </span>
          </div>
        </div>

        {/* Momentum Score */}
        <div id="momentum-score" className="scroll-mt-24 mb-8">
          <h3 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-xs font-bold text-accent">3</span>
            Momentum Score <span className="text-sm text-text-muted font-normal">(15% weight)</span>
          </h3>
          <p className="text-text-secondary text-sm leading-relaxed">
            Measures recent price movement direction and velocity. A market trending in your direction adds confidence. Sudden spikes or consistent upward movement on the recommended side boosts this score.
          </p>
        </div>

        {/* Liquidity Score */}
        <div id="liquidity-score" className="scroll-mt-24 mb-8">
          <h3 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-xs font-bold text-accent">4</span>
            Liquidity Score <span className="text-sm text-text-muted font-normal">(15% weight)</span>
          </h3>
          <p className="text-text-secondary text-sm leading-relaxed">
            How easily you can enter and exit the position. Markets with higher volume, tighter spreads, and deeper order books score higher. Low liquidity means you might face slippage — your actual fill price could differ from what you see.
          </p>
        </div>

        {/* Inefficiency Score */}
        <div id="inefficiency-score" className="scroll-mt-24 mb-8">
          <h3 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-xs font-bold text-accent">5</span>
            Inefficiency Score <span className="text-sm text-text-muted font-normal">(15% weight)</span>
          </h3>
          <p className="text-text-secondary text-sm leading-relaxed">
            Detects structural mispricing. This looks for: divergence between related markets, stale prices that haven&apos;t updated after relevant news, and markets where informed traders (&ldquo;smart money&rdquo;) are accumulating positions.
          </p>
        </div>

        {/* Recency Score */}
        <div id="recency-score" className="scroll-mt-24 mb-8">
          <h3 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-xs font-bold text-accent">6</span>
            Recency Score <span className="text-sm text-text-muted font-normal">(10% weight)</span>
          </h3>
          <p className="text-text-secondary text-sm leading-relaxed">
            Freshness of the signal. Newer picks are weighted higher because market conditions change fast. A pick from 2 hours ago is more relevant than one from 2 days ago.
          </p>
        </div>
      </section>
    </div>
  );
}
