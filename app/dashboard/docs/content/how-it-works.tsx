"use client";

import React from "react";
import { DocsCallout } from "../components/DocsCallout";
import { CodeBlock } from "../components/CodeBlock";
import type { TOCItem } from "../components/DocsTOC";

export const howItWorksTOC: TOCItem[] = [
  { id: "market-scoring", title: "Market Scoring Algorithm", level: 2 },
  { id: "trader-ranking", title: "Trader Ranking", level: 2 },
  { id: "skill-vs-luck", title: "Detecting Skill vs Luck", level: 2 },
  { id: "disqualification", title: "Disqualification Criteria", level: 3 },
];

export function HowItWorksContent() {
  return (
    <div className="docs-content">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-text-primary mb-3">
          How It Works
        </h1>
        <p className="text-lg text-text-secondary leading-relaxed">
          A deeper look at the algorithms powering Déjà&apos;s picks and trader rankings.
        </p>
      </div>

      {/* Market Scoring Algorithm */}
      <section id="market-scoring" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> Market Scoring Algorithm
        </h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          Every market on Polymarket gets analyzed and scored in real-time. Here&apos;s the full breakdown of our composite scoring formula:
        </p>

        <CodeBlock language="formula" title="Market Composite Score">
{`Composite Score = 
  (0.25 × Edge Score)
+ (0.20 × Risk/Reward Score)
+ (0.15 × Momentum Score)
+ (0.15 × Liquidity Score)
+ (0.15 × Inefficiency Score)
+ (0.10 × Recency Score)

Each sub-score is normalized to 0-100.
Final score is also 0-100.`}
        </CodeBlock>

        <h3 className="text-lg font-semibold text-text-primary mt-8 mb-3">Deep Dive: Each Factor</h3>

        <div className="space-y-6">
          {/* Edge */}
          <div className="rounded-xl border border-ep-border bg-ep-card/30 p-5">
            <h4 className="text-sm font-bold text-text-primary mb-2 flex items-center gap-2">
              <span className="text-accent font-mono">25%</span> Edge Score
            </h4>
            <p className="text-sm text-text-secondary leading-relaxed mb-3">
              We estimate the &ldquo;fair value&rdquo; of each market using multiple signals: historical resolution patterns, sentiment analysis, related market prices, and real-world data feeds.
            </p>
            <div className="rounded-lg bg-ep-surface/50 p-3 text-sm font-mono text-text-muted">
              Edge = |Fair Value − Market Price| / Market Price × 100
            </div>
            <p className="text-xs text-text-muted mt-2">
              Example: Fair value 75¢, market price 60¢ → Edge = 25%. This is a strong signal.
            </p>
          </div>

          {/* Risk/Reward */}
          <div className="rounded-xl border border-ep-border bg-ep-card/30 p-5">
            <h4 className="text-sm font-bold text-text-primary mb-2 flex items-center gap-2">
              <span className="text-accent font-mono">20%</span> Risk/Reward Score
            </h4>
            <p className="text-sm text-text-secondary leading-relaxed mb-3">
              Asymmetric payoff potential. We want markets where the upside significantly outweighs the downside.
            </p>
            <div className="rounded-lg bg-ep-surface/50 p-3 text-sm font-mono text-text-muted">
              R/R = (1 - Entry Price) / Entry Price
            </div>
            <p className="text-xs text-text-muted mt-2">
              Example: Buy at 15¢ → potential 85¢ profit vs 15¢ risk = 5.67:1 R/R. Excellent.
            </p>
          </div>

          {/* Momentum */}
          <div className="rounded-xl border border-ep-border bg-ep-card/30 p-5">
            <h4 className="text-sm font-bold text-text-primary mb-2 flex items-center gap-2">
              <span className="text-accent font-mono">15%</span> Momentum Score
            </h4>
            <p className="text-sm text-text-secondary leading-relaxed">
              Price velocity over the last 1h, 6h, and 24h periods. Weighted toward recent movement. Markets trending in our recommended direction get a boost; counter-trending markets get penalized.
            </p>
          </div>

          {/* Liquidity */}
          <div className="rounded-xl border border-ep-border bg-ep-card/30 p-5">
            <h4 className="text-sm font-bold text-text-primary mb-2 flex items-center gap-2">
              <span className="text-accent font-mono">15%</span> Liquidity Score
            </h4>
            <p className="text-sm text-text-secondary leading-relaxed">
              Combines 24h volume, order book depth, and bid-ask spread. Higher liquidity = lower slippage = better execution for you. Markets under $10k daily volume are heavily penalized.
            </p>
          </div>

          {/* Inefficiency */}
          <div className="rounded-xl border border-ep-border bg-ep-card/30 p-5">
            <h4 className="text-sm font-bold text-text-primary mb-2 flex items-center gap-2">
              <span className="text-accent font-mono">15%</span> Inefficiency Score
            </h4>
            <p className="text-sm text-text-secondary leading-relaxed">
              Structural mispricing detection. We look for: stale prices that haven&apos;t reacted to news, divergence between correlated markets, and large orders from historically profitable wallets.
            </p>
          </div>

          {/* Recency */}
          <div className="rounded-xl border border-ep-border bg-ep-card/30 p-5">
            <h4 className="text-sm font-bold text-text-primary mb-2 flex items-center gap-2">
              <span className="text-accent font-mono">10%</span> Recency Score
            </h4>
            <p className="text-sm text-text-secondary leading-relaxed">
              Exponential decay based on when the signal was generated. Picks older than 48 hours are automatically deprioritized. Fresh signals get the highest weight.
            </p>
          </div>
        </div>
      </section>

      {/* Trader Ranking */}
      <section id="trader-ranking" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> Trader Ranking
        </h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          Why don&apos;t we just rank traders by PnL? Because <strong className="text-text-primary">PnL alone is deeply misleading</strong>.
        </p>

        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5 mb-6">
          <h4 className="text-sm font-bold text-yellow-400 mb-3">⚠️ The PnL Trap</h4>
          <p className="text-sm text-text-secondary leading-relaxed mb-3">
            Consider two traders:
          </p>
          <div className="grid gap-3 sm:grid-cols-2 mb-3">
            <div className="rounded-lg bg-ep-card/50 border border-ep-border p-3">
              <div className="text-sm font-bold text-text-primary mb-1">Trader A</div>
              <div className="text-xs text-text-secondary space-y-1">
                <div>PnL: <span className="text-accent">+$50,000</span></div>
                <div>Win Rate: 52%</div>
                <div>Volume: $2,000,000</div>
                <div>Method: Huge bets, high variance</div>
              </div>
            </div>
            <div className="rounded-lg bg-ep-card/50 border border-ep-border p-3">
              <div className="text-sm font-bold text-text-primary mb-1">Trader B</div>
              <div className="text-xs text-text-secondary space-y-1">
                <div>PnL: <span className="text-accent">+$5,000</span></div>
                <div>Win Rate: 71%</div>
                <div>Volume: $20,000</div>
                <div>Method: Calculated, consistent</div>
              </div>
            </div>
          </div>
          <p className="text-sm text-text-secondary">
            Trader A has 10x more profit, but Trader B has a 25% ROI vs Trader A&apos;s 2.5%. Trader B is the <em>better trader</em> — more skilled, more consistent, and more worth following.
          </p>
        </div>

        <h3 className="text-base font-semibold text-text-primary mb-3">Minimum Qualifications</h3>
        <p className="text-text-secondary text-sm leading-relaxed mb-3">
          To be ranked at all, a trader must meet these minimum thresholds:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: "Trades", value: "10+", icon: "📝" },
            { label: "Resolved", value: "5+", icon: "✅" },
            { label: "Volume", value: "$500+", icon: "💰" },
            { label: "Active Days", value: "7+", icon: "📅" },
          ].map((req) => (
            <div key={req.label} className="rounded-xl border border-ep-border bg-ep-card/50 p-4 text-center">
              <div className="text-xl mb-1">{req.icon}</div>
              <div className="text-sm font-bold text-accent">{req.value}</div>
              <div className="text-xs text-text-muted">{req.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Skill vs Luck */}
      <section id="skill-vs-luck" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> Detecting Skill vs Luck
        </h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          Anyone can get lucky for a week. We need to distinguish genuine skill from variance. Here&apos;s how:
        </p>

        <ul className="space-y-3 mb-6 text-sm text-text-secondary">
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">1</span>
            <div>
              <strong className="text-text-primary">Sample size requirements</strong> — Minimum 10 trades and 5 resolved positions. Below this, we don&apos;t have enough data to judge.
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">2</span>
            <div>
              <strong className="text-text-primary">Consistency score</strong> — We measure returns on rolling 7-day windows. A skilled trader has a positive trendline, not a single spike.
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">3</span>
            <div>
              <strong className="text-text-primary">Edge analysis</strong> — Are they consistently buying at better prices than the crowd? This is hard to fake over many trades.
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">4</span>
            <div>
              <strong className="text-text-primary">Category depth</strong> — Traders who perform well across multiple categories are more likely skilled than those who nailed one lucky bet.
            </div>
          </li>
        </ul>

        <div id="disqualification" className="scroll-mt-24">
          <h3 className="text-base font-semibold text-text-primary mb-3">Disqualification Criteria</h3>
          <p className="text-text-secondary text-sm leading-relaxed mb-3">
            Traders are removed from rankings if they meet any of these criteria:
          </p>
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
            <ul className="space-y-2 text-sm text-text-secondary">
              <li className="flex items-start gap-2">
                <span className="text-red-400">✕</span>
                Inactive for more than 30 days (no trades placed)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">✕</span>
                Negative edge over last 30 resolved positions
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">✕</span>
                Suspected wash trading or self-dealing patterns
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400">✕</span>
                Less than minimum thresholds (fewer than 10 trades, etc.)
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
