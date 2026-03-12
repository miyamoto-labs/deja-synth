"use client";

import React from "react";
import { DocsCallout } from "../components/DocsCallout";
import { CodeBlock } from "../components/CodeBlock";
import type { TOCItem } from "../components/DocsTOC";

export const advancedTOC: TOCItem[] = [
  { id: "edge-detection", title: "Edge Detection", level: 2 },
  { id: "risk-reward", title: "Risk/Reward Calculations", level: 2 },
  { id: "market-inefficiencies", title: "Market Inefficiencies", level: 2 },
  { id: "smart-money", title: "Smart Money Signals", level: 2 },
];

export function AdvancedContent() {
  return (
    <div className="docs-content">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-lg bg-accent/10 border border-accent/20 px-3 py-1 text-xs font-semibold text-accent uppercase tracking-wider mb-4">
          🧪 Advanced
        </div>
        <h1 className="text-3xl font-display font-bold text-text-primary mb-3">
          Advanced Concepts
        </h1>
        <p className="text-lg text-text-secondary leading-relaxed">
          For power users who want to understand the deeper mechanics behind Déjà&apos;s intelligence.
        </p>
      </div>

      {/* Edge Detection */}
      <section id="edge-detection" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> Understanding Edge Detection
        </h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          &ldquo;Edge&rdquo; is the difference between what the market thinks will happen and what&apos;s <em>actually</em> likely to happen. Finding edge is the core skill in prediction markets.
        </p>

        <h3 className="text-base font-semibold text-text-primary mb-3">How We Detect Edge</h3>
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          Our edge detection combines multiple signal sources:
        </p>

        <div className="space-y-3 mb-6">
          {[
            { name: "Statistical Models", icon: "📐", desc: "Historical resolution patterns for similar market types. If 'Will X happen by Y date?' markets historically resolve YES 70% of the time when priced at 50¢, that's a detectable edge." },
            { name: "Cross-Market Analysis", icon: "🔗", desc: "Related markets should be consistent. If 'Team A wins championship' is at 40¢ but 'Team A wins semifinal' is at 30¢, something is mispriced." },
            { name: "News & Sentiment", icon: "📰", desc: "Markets can be slow to react to breaking news. We monitor news feeds and detect when a market price hasn't adjusted to new information." },
            { name: "Smart Money Tracking", icon: "🐋", desc: "When wallets with proven track records take large positions, it's a signal. They've likely done analysis the crowd hasn't." },
          ].map((item) => (
            <div key={item.name} className="flex items-start gap-4 rounded-lg bg-ep-card/30 border border-ep-border/50 p-4">
              <span className="text-xl flex-shrink-0">{item.icon}</span>
              <div>
                <h4 className="text-sm font-semibold text-text-primary mb-1">{item.name}</h4>
                <p className="text-xs text-text-secondary leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <CodeBlock language="pseudocode" title="Edge Detection Pipeline">
{`for each active_market in polymarket:
    fair_value = weighted_average(
        statistical_model(market),     // 35%
        cross_market_signal(market),   // 25%
        sentiment_analysis(market),    // 20%
        smart_money_signal(market)     // 20%
    )
    
    edge = fair_value - market_price
    
    if abs(edge) > minimum_threshold:
        generate_pick(market, edge, direction)`}
        </CodeBlock>
      </section>

      {/* Risk/Reward Calculations */}
      <section id="risk-reward" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> Risk/Reward Calculations
        </h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          In prediction markets, risk/reward is elegantly simple because outcomes are binary (Yes or No, paying $0 or $1 per share).
        </p>

        <CodeBlock language="formula" title="R/R Formula">
{`Risk (Downside) = Entry Price (what you lose if wrong)
Reward (Upside) = 1.00 - Entry Price (what you gain if right)

R/R Ratio = Reward / Risk

Examples:
  Buy YES at $0.20 → R/R = 0.80/0.20 = 4.0:1
  Buy YES at $0.50 → R/R = 0.50/0.50 = 1.0:1
  Buy YES at $0.80 → R/R = 0.20/0.80 = 0.25:1
  
The lower the entry price, the better the R/R.
But probability matters too — cheap ≠ good.`}
        </CodeBlock>

        <h3 className="text-base font-semibold text-text-primary mt-6 mb-3">Expected Value (EV)</h3>
        <p className="text-text-secondary text-sm leading-relaxed mb-3">
          The real metric to optimize for is <strong className="text-text-primary">Expected Value</strong> — what you expect to make on average per bet.
        </p>

        <CodeBlock language="formula" title="Expected Value">
{`EV = (Probability × Reward) - ((1 - Probability) × Risk)

Example:
  Market price: 40¢ YES
  Our estimated probability: 55%
  
  EV = (0.55 × $0.60) - (0.45 × $0.40)
  EV = $0.33 - $0.18
  EV = +$0.15 per share
  
  Positive EV = good bet over time.`}
        </CodeBlock>

        <DocsCallout type="tip">
          A bet doesn&apos;t need to win every time to be profitable. If you consistently make +EV bets, the math works out in your favor over enough trades. This is how casinos and professional traders think.
        </DocsCallout>
      </section>

      {/* Market Inefficiencies */}
      <section id="market-inefficiencies" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> Market Inefficiencies We Exploit
        </h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          Prediction markets are not perfectly efficient. Here are the main types of inefficiencies our algorithm targets:
        </p>

        <div className="space-y-4">
          {[
            {
              name: "Stale Pricing",
              icon: "⏰",
              desc: "Markets that haven't reacted to new information. Example: A court ruling drops at 2 AM UTC but the related prediction market doesn't move for hours because most traders are asleep.",
              severity: "Common",
            },
            {
              name: "Favorite-Longshot Bias",
              icon: "🎰",
              desc: "Markets systematically overprice unlikely outcomes (longshots) and underprice likely outcomes (favorites). This is a well-documented behavioral bias from horse racing that carries into prediction markets.",
              severity: "Persistent",
            },
            {
              name: "Correlated Market Divergence",
              icon: "🔀",
              desc: "When two related markets should move together but don't. If Market A implies 60% and Market B (which depends on A) implies 80%, the divergence is exploitable.",
              severity: "Frequent",
            },
            {
              name: "Low-Liquidity Mispricing",
              icon: "💧",
              desc: "Small markets with thin order books can drift far from fair value because there aren't enough participants to correct the price. One large, informed order can move the market significantly.",
              severity: "Very Common",
            },
            {
              name: "Recency Bias",
              icon: "📅",
              desc: "Traders overweight recent events. After a team wins two games in a row, the market may overprice their chances in the third game, ignoring base rates and season-long statistics.",
              severity: "Common",
            },
          ].map((item) => (
            <div key={item.name} className="rounded-xl border border-ep-border bg-ep-card/30 p-5">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xl">{item.icon}</span>
                <h4 className="text-sm font-bold text-text-primary">{item.name}</h4>
                <span className="text-[10px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full uppercase">
                  {item.severity}
                </span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Smart Money Signals */}
      <section id="smart-money" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> Smart Money Signals
        </h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          &ldquo;Smart money&rdquo; refers to wallets with proven, consistent profitability. When they make large moves, it&apos;s worth paying attention.
        </p>

        <div className="rounded-xl border border-accent/20 bg-accent/5 p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🔮</span>
            <span className="text-sm font-semibold text-accent">Coming Soon: MetEngine</span>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">
            MetEngine is our upcoming smart money tracking feature that will give you real-time alerts when top-tier wallets take new positions. 
            Think of it as a &ldquo;whale alert&rdquo; for prediction markets — but filtered for quality, not just size.
          </p>
        </div>

        <h3 className="text-base font-semibold text-text-primary mb-3">What Smart Money Signals Look Like</h3>
        <ul className="space-y-2 text-sm text-text-secondary">
          <li className="flex items-start gap-2">
            <span className="text-accent">→</span>
            <span><strong className="text-text-primary">Large position entry</strong> — An S-tier wallet buys $5,000+ in a single market</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent">→</span>
            <span><strong className="text-text-primary">Cluster buying</strong> — Multiple top wallets independently buy the same side within 24 hours</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent">→</span>
            <span><strong className="text-text-primary">Contrarian moves</strong> — A top trader takes the opposite side of the crowd in a trending market</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent">→</span>
            <span><strong className="text-text-primary">Early positioning</strong> — Smart money entering a new market before volume picks up</span>
          </li>
        </ul>

        <DocsCallout type="info">
          Smart money signals are already factored into our pick scoring (Inefficiency Score component). MetEngine will make these signals directly visible to you as standalone alerts.
        </DocsCallout>
      </section>
    </div>
  );
}
