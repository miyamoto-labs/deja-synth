"use client";

import React from "react";
import { DocsCallout } from "../components/DocsCallout";
import type { TOCItem } from "../components/DocsTOC";

export const polytinderTOC: TOCItem[] = [
  { id: "swipe-mechanics", title: "Swipe Mechanics", level: 2 },
  { id: "bet-presets", title: "Bet Presets", level: 2 },
  { id: "skip-vs-bet", title: "Skip vs Bet", level: 2 },
  { id: "deck-selection", title: "Deck Selection", level: 2 },
];

export function PolytinderContent() {
  return (
    <div className="docs-content">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-text-primary mb-3">
          PolyTinder
        </h1>
        <p className="text-lg text-text-secondary leading-relaxed">
          Swipe right on predictions you believe in. The fastest way to discover and bet on markets.
        </p>
      </div>

      {/* Swipe Mechanics */}
      <section id="swipe-mechanics" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> Swipe Mechanics
        </h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          PolyTinder presents markets one at a time in a card stack, similar to dating apps. For each card, you see:
        </p>
        <ul className="space-y-2 mb-4 text-sm text-text-secondary">
          <li className="flex items-start gap-2">
            <span className="text-accent">→</span>
            The market question
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent">→</span>
            Current price (YES/NO)
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent">→</span>
            Our conviction score and recommended side
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent">→</span>
            Category, volume, and expiry date
          </li>
        </ul>

        <div className="rounded-xl border border-ep-border bg-ep-card/50 p-6 mb-4">
          <div className="text-center mb-4">
            <div className="text-4xl mb-3">👆</div>
            <div className="text-sm text-text-primary font-semibold">Swipe Gestures</div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="rounded-lg bg-accent/5 border border-accent/20 p-4">
              <div className="text-2xl mb-2">👉</div>
              <div className="text-sm font-semibold text-accent">Swipe Right</div>
              <div className="text-xs text-text-muted mt-1">Bet on this market</div>
            </div>
            <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-4">
              <div className="text-2xl mb-2">👈</div>
              <div className="text-sm font-semibold text-red-400">Swipe Left</div>
              <div className="text-xs text-text-muted mt-1">Skip this market</div>
            </div>
          </div>
        </div>

        <DocsCallout type="tip">
          On desktop, you can also use keyboard shortcuts: <code className="text-accent bg-accent/5 px-1.5 py-0.5 rounded text-xs">→</code> to bet and <code className="text-accent bg-accent/5 px-1.5 py-0.5 rounded text-xs">←</code> to skip. Or just click the buttons.
        </DocsCallout>
      </section>

      {/* Bet Presets */}
      <section id="bet-presets" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> Bet Presets
        </h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          When you swipe right, you choose from four preset bet amounts. This keeps the flow fast — no fiddling with custom amounts.
        </p>

        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { amount: "$5", label: "Micro", color: "border-gray-500/30 bg-gray-500/5" },
            { amount: "$10", label: "Small", color: "border-blue-500/30 bg-blue-500/5" },
            { amount: "$25", label: "Medium", color: "border-yellow-500/30 bg-yellow-500/5" },
            { amount: "$50", label: "Large", color: "border-accent/30 bg-accent/5" },
          ].map((preset) => (
            <div key={preset.amount} className={`rounded-xl border ${preset.color} p-4 text-center`}>
              <div className="text-xl font-bold text-text-primary">{preset.amount}</div>
              <div className="text-xs text-text-muted mt-1">{preset.label}</div>
            </div>
          ))}
        </div>

        <DocsCallout type="info">
          These presets execute a market order at the current best price. Actual fill may vary slightly due to spread and slippage, especially in low-liquidity markets.
        </DocsCallout>
      </section>

      {/* Skip vs Bet */}
      <section id="skip-vs-bet" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> Skip vs Bet
        </h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          Not every market is worth your money. Here&apos;s how to think about it:
        </p>

        <div className="grid gap-4 sm:grid-cols-2 mb-4">
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-5">
            <h4 className="text-sm font-bold text-accent mb-3">✅ Bet when...</h4>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li className="flex items-start gap-2">
                <span className="text-accent text-xs mt-1">•</span>
                You understand the market question
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent text-xs mt-1">•</span>
                The conviction score is high (70+)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent text-xs mt-1">•</span>
                You have a view on the outcome
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent text-xs mt-1">•</span>
                The risk/reward looks favorable
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
            <h4 className="text-sm font-bold text-red-400 mb-3">❌ Skip when...</h4>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li className="flex items-start gap-2">
                <span className="text-red-400 text-xs mt-1">•</span>
                You don&apos;t understand the topic
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 text-xs mt-1">•</span>
                Low conviction score (&lt;50)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 text-xs mt-1">•</span>
                The market resolves too far in the future
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 text-xs mt-1">•</span>
                Low liquidity (your order might not fill well)
              </li>
            </ul>
          </div>
        </div>

        <DocsCallout type="tip">
          The best traders skip more than they bet. Being selective is a sign of discipline, not weakness.
        </DocsCallout>
      </section>

      {/* Deck Selection */}
      <section id="deck-selection" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> How Picks Are Selected for the Deck
        </h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          The PolyTinder deck isn&apos;t random. Our algorithm curates the card order to maximize discovery:
        </p>

        <div className="space-y-3 mb-4">
          {[
            { num: "1", title: "Score-weighted", desc: "Higher-scoring picks appear earlier in the deck, but not always first — some variety is good." },
            { num: "2", title: "Category mix", desc: "We blend categories to keep things interesting. You won't get 20 politics picks in a row." },
            { num: "3", title: "Freshness bias", desc: "Newer picks are prioritized. You see today's opportunities before yesterday's." },
            { num: "4", title: "No repeats", desc: "Markets you've already swiped on won't reappear in the same session." },
            { num: "5", title: "Wild cards", desc: "Periodically, a Wild Pick gets shuffled in for those high-risk/high-reward moments." },
          ].map((item) => (
            <div key={item.num} className="flex items-start gap-3 rounded-lg bg-ep-card/30 border border-ep-border/50 p-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">{item.num}</span>
              <div>
                <span className="text-sm font-medium text-text-primary">{item.title}</span>
                <span className="text-sm text-text-muted"> — {item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
