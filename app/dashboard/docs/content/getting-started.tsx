"use client";

import React from "react";
import { DocsCallout } from "../components/DocsCallout";
import type { TOCItem } from "../components/DocsTOC";

export const gettingStartedTOC: TOCItem[] = [
  { id: "what-is-deja", title: "What is Déjà?", level: 2 },
  { id: "connect-wallet", title: "Connect Your Wallet", level: 2 },
  { id: "first-pick", title: "Your First Pick", level: 2 },
  { id: "understanding-tiers", title: "Understanding Tiers", level: 2 },
];

export function GettingStartedContent() {
  return (
    <div className="docs-content">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-text-primary mb-3">
          Getting Started
        </h1>
        <p className="text-lg text-text-secondary leading-relaxed">
          Everything you need to start making smarter predictions on Polymarket.
        </p>
      </div>

      {/* What is Déjà */}
      <section id="what-is-deja" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> What is Déjà?
        </h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          Déjà is an AI-powered prediction market intelligence platform built on top of{" "}
          <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            Polymarket
          </a>
          . We analyze thousands of prediction markets in real-time to surface the best trading opportunities — so you don&apos;t have to.
        </p>
        <p className="text-text-secondary leading-relaxed mb-4">
          Think of it like having a team of analysts working 24/7, scanning every market for:
        </p>
        <ul className="space-y-2 mb-4 ml-1">
          {[
            ["📊", "Mispriced odds", "Markets where the price doesn't match reality"],
            ["📈", "Momentum shifts", "Markets moving fast that you should know about"],
            ["💎", "Hidden gems", "Obscure markets with great risk/reward ratios"],
            ["🔥", "Top traders", "The best Polymarket traders and what they're buying"],
          ].map(([icon, title, desc]) => (
            <li key={title} className="flex items-start gap-3 text-text-secondary">
              <span className="text-lg mt-0.5">{icon}</span>
              <div>
                <span className="text-text-primary font-medium">{title}</span>
                <span className="text-text-muted"> — {desc}</span>
              </div>
            </li>
          ))}
        </ul>

        <DocsCallout type="info">
          Déjà doesn&apos;t hold your funds or execute trades on your behalf. You always trade directly on Polymarket through your own wallet.
        </DocsCallout>
      </section>

      {/* Connect Wallet */}
      <section id="connect-wallet" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> Connect Your Wallet
        </h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          Déjà uses <strong className="text-text-primary">Privy</strong> for wallet authentication — meaning you can sign in with your email, Google account, or existing crypto wallet.
        </p>

        <div className="space-y-4 mb-6">
          {[
            { step: "1", title: "Click \"Connect Wallet\"", desc: "Hit the connect button in the top-right corner of the dashboard." },
            { step: "2", title: "Choose your method", desc: "Sign in with email, Google, or connect an existing wallet (MetaMask, Coinbase Wallet, etc.)." },
            { step: "3", title: "Approve the connection", desc: "If using an external wallet, approve the connection request in your wallet app." },
            { step: "4", title: "You're in!", desc: "Your dashboard will load with the latest picks, traders, and market opportunities." },
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

        <DocsCallout type="tip">
          New to crypto? Choose &ldquo;Email&rdquo; sign-in — Privy creates a secure embedded wallet for you automatically. No extensions or seed phrases needed.
        </DocsCallout>
      </section>

      {/* Your First Pick */}
      <section id="first-pick" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> Your First Pick
        </h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          Once you&apos;re connected, you&apos;ll land on the <strong className="text-text-primary">Picks</strong> page — the heart of Déjà. Here&apos;s how to make your first trade:
        </p>

        <div className="space-y-4 mb-6">
          {[
            { step: "1", title: "Browse the picks", desc: "Each card shows a market question, our conviction score, and the recommended side (Yes or No)." },
            { step: "2", title: "Check the conviction score", desc: "Higher scores (80-100) mean our algorithm is more confident. Green = high conviction, yellow = medium, red = low." },
            { step: "3", title: "Click a pick to expand", desc: "See the full analysis — edge score, risk/reward ratio, momentum, and why we think this market is mispriced." },
            { step: "4", title: "Hit \"Trade on Polymarket\"", desc: "This opens the market directly on Polymarket where you can place your bet with any amount you're comfortable with." },
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
          Prediction markets involve real money. Start small, understand the mechanics, and never bet more than you can afford to lose.
        </DocsCallout>

        {/* Example pick */}
        <div className="mt-6 rounded-xl border border-ep-border bg-ep-card/50 p-5">
          <div className="text-xs text-text-muted uppercase tracking-wider mb-2">Example Pick</div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-1">
                &ldquo;Will Bitcoin hit $100k by March 2026?&rdquo;
              </h4>
              <p className="text-xs text-text-muted">
                Current price: <span className="text-accent">62¢ YES</span> • Our target: 78¢ • Edge: +16¢
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              <div className="text-2xl font-bold text-accent">87</div>
              <div className="text-xs text-text-muted">Score</div>
            </div>
          </div>
        </div>
      </section>

      {/* Understanding Tiers */}
      <section id="understanding-tiers" className="scroll-mt-24 mb-12">
        <h2 className="text-xl font-display font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="text-accent">◆</span> Understanding Tiers
        </h2>
        <p className="text-text-secondary leading-relaxed mb-4">
          We rank both picks and traders using a tier system inspired by gacha games. Each tier represents a quality level based on our composite scoring algorithms.
        </p>

        <div className="grid gap-3">
          {[
            { tier: "S", icon: "🔥", name: "Elite", range: "90-100", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", desc: "Top 1%. Exceptional edge, high conviction. These are the cream of the crop." },
            { tier: "A", icon: "💎", name: "Strong", range: "75-89", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", desc: "Top 10%. Very strong opportunities with solid fundamentals." },
            { tier: "B", icon: "⚡", name: "Decent", range: "60-74", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", desc: "Above average. Good picks worth considering, but not as compelling." },
            { tier: "C", icon: "📊", name: "Marginal", range: "40-59", color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20", desc: "Average. Slight edge, but higher risk of being wrong." },
            { tier: "D", icon: "⬇️", name: "Weak", range: "0-39", color: "text-gray-600", bg: "bg-gray-500/5 border-gray-500/10", desc: "Below threshold. Generally not recommended unless you have your own conviction." },
          ].map((item) => (
            <div
              key={item.tier}
              className={`flex items-center gap-4 rounded-xl border ${item.bg} p-4`}
            >
              <div className={`text-2xl font-display font-bold ${item.color} w-12 text-center`}>
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-sm font-bold ${item.color}`}>Tier {item.tier}</span>
                  <span className="text-xs text-text-muted">• {item.name}</span>
                  <span className="text-xs text-text-muted font-mono">({item.range})</span>
                </div>
                <p className="text-xs text-text-secondary">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <DocsCallout type="tip">
          Filter by tier to focus on the quality level you&apos;re comfortable with. Most experienced traders focus on S and A tier picks.
        </DocsCallout>
      </section>
    </div>
  );
}
