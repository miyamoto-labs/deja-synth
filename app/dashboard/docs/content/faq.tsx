"use client";

import React, { useState } from "react";
import type { TOCItem } from "../components/DocsTOC";

export const faqTOC: TOCItem[] = [
  { id: "faq-place-bet", title: "How do I place a bet?", level: 2 },
  { id: "faq-tier-badges", title: "What are tier badges?", level: 2 },
  { id: "faq-free", title: "Is Déjà free?", level: 2 },
  { id: "faq-picks-vs-polytinder", title: "Picks vs PolyTinder?", level: 2 },
  { id: "faq-copy-trader", title: "How do I copy a trader?", level: 2 },
  { id: "faq-wild-picks", title: "What are Wild Picks?", level: 2 },
  { id: "faq-update-frequency", title: "How often are picks updated?", level: 2 },
  { id: "faq-filter-category", title: "Can I filter by category?", level: 2 },
  { id: "faq-super-pick", title: "What's a Daily Super Pick?", level: 2 },
];

interface FAQItemProps {
  id: string;
  question: string;
  answer: React.ReactNode;
}

function FAQItem({ id, question, answer }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div id={id} className="scroll-mt-24 border-b border-ep-border last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-4 py-5 text-left group"
      >
        <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent transition">
          {question}
        </h3>
        <svg
          className={`h-5 w-5 text-text-muted flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isOpen ? "max-h-96 opacity-100 pb-5" : "max-h-0 opacity-0"
        }`}
      >
        <div className="text-sm text-text-secondary leading-relaxed pr-8">
          {answer}
        </div>
      </div>
    </div>
  );
}

const faqItems: FAQItemProps[] = [
  {
    id: "faq-place-bet",
    question: "How do I place a bet?",
    answer: (
      <>
        <p className="mb-2">
          Déjà surfaces opportunities — you trade on Polymarket directly. Here&apos;s the flow:
        </p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Find a pick you like on the Picks page or PolyTinder</li>
          <li>Click &ldquo;Trade on Polymarket&rdquo; to open the market</li>
          <li>Choose your amount and confirm the transaction in your wallet</li>
          <li>Your position appears in your Portfolio</li>
        </ol>
      </>
    ),
  },
  {
    id: "faq-tier-badges",
    question: "What are tier badges?",
    answer: (
      <p>
        Tiers rank quality from S (Elite, top 1%) to D (Weak). Both picks and traders get tier badges. 
        <strong className="text-text-primary"> S-tier 🔥</strong> is the best, 
        <strong className="text-text-primary"> A-tier 💎</strong> is strong, 
        <strong className="text-text-primary"> B-tier ⚡</strong> is decent, 
        <strong className="text-text-primary"> C-tier 📊</strong> is marginal, and 
        <strong className="text-text-primary"> D-tier ⬇️</strong> is weak. Focus on S and A tiers for the highest-quality signals.
      </p>
    ),
  },
  {
    id: "faq-free",
    question: "Is Déjà free?",
    answer: (
      <p>
        Yes! Déjà is currently free during beta. You get full access to picks, PolyTinder, trader discovery, and portfolio tracking. 
        We may introduce premium features in the future, but the core experience will always have a free tier.
      </p>
    ),
  },
  {
    id: "faq-picks-vs-polytinder",
    question: "What's the difference between Picks and PolyTinder?",
    answer: (
      <>
        <p className="mb-2">
          They use the same underlying data but present it differently:
        </p>
        <ul className="space-y-1">
          <li><strong className="text-text-primary">Picks</strong> — Full list view. Browse, filter, sort, and dig deep into analysis. Best for research.</li>
          <li><strong className="text-text-primary">PolyTinder</strong> — Card-by-card swipe view. Quick decisions, preset bet amounts. Best for fast discovery and action.</li>
        </ul>
      </>
    ),
  },
  {
    id: "faq-copy-trader",
    question: "How do I copy a trader?",
    answer: (
      <>
        <p className="mb-2">
          Currently, copy trading is signal-based (not automated). To follow a trader:
        </p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Go to the Traders page and find a trader you like</li>
          <li>Click their profile to see current positions</li>
          <li>When they have a position you agree with, click through to trade on Polymarket</li>
        </ol>
        <p className="mt-2 text-text-muted">
          Automated copy trading (auto-mirroring) is on our roadmap.
        </p>
      </>
    ),
  },
  {
    id: "faq-wild-picks",
    question: "What are Wild Picks?",
    answer: (
      <p>
        Wild Picks are high-risk, high-reward opportunities with asymmetric payoff profiles. They typically trade at very low prices (5¢-20¢) 
        with potential for 5-20x returns. Think of them like lottery tickets — fun, but don&apos;t bet the farm. 
        They&apos;re marked with a special 🃏 badge so you know what you&apos;re getting into.
      </p>
    ),
  },
  {
    id: "faq-update-frequency",
    question: "How often are picks updated?",
    answer: (
      <p>
        Picks are updated continuously as market conditions change. New picks are generated every few minutes. 
        The Daily Super Pick refreshes once per day at 00:00 UTC. Scores are recalculated in real-time as prices, 
        volume, and momentum shift.
      </p>
    ),
  },
  {
    id: "faq-filter-category",
    question: "Can I filter by category?",
    answer: (
      <p>
        Yes! Both the Picks page and Traders page support category filters. Choose from Politics 🏛️, Sports ⚽, 
        Crypto ₿, Culture 🎬, Finance 💹, or Wild 🃏. You can also combine filters with tier badges and 
        sort options for precise discovery.
      </p>
    ),
  },
  {
    id: "faq-super-pick",
    question: "What's a Daily Super Pick?",
    answer: (
      <p>
        The Daily Super Pick is our single highest-conviction opportunity each day. It&apos;s chosen by scoring 
        all active markets, filtering for minimum liquidity ($50k+) and edge (10%+), and selecting the top scorer. 
        It appears at the top of the Picks page with a gold border. Historical win rate: ~68%.
      </p>
    ),
  },
];

export function FAQContent() {
  return (
    <div className="docs-content">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-text-primary mb-3">
          Frequently Asked Questions
        </h1>
        <p className="text-lg text-text-secondary leading-relaxed">
          Quick answers to common questions about Déjà.
        </p>
      </div>

      <div className="rounded-xl border border-ep-border bg-ep-card/30 divide-y divide-ep-border px-5">
        {faqItems.map((item) => (
          <FAQItem key={item.id} {...item} />
        ))}
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-text-muted mb-3">Still have questions?</p>
        <a
          href="https://t.me/dejacommunity"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-accent/10 border border-accent/20 px-5 py-2.5 text-sm font-medium text-accent hover:bg-accent/15 transition"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
          Ask in our Telegram community
        </a>
      </div>
    </div>
  );
}
