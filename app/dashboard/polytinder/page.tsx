"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { SwipeCardStack } from "@/app/components/ui/SwipeCardStack";
import type { FeedCard } from "@/app/components/ui/SwipeCard";
import { useUserStore } from "@/app/lib/stores/user-store";
import { usePrivy } from "@privy-io/react-auth";

/* ── Constants ──────────────────────────────────── */
const BET_PRESETS = [5, 10, 25, 50];
const LS_AMOUNT_KEY = "ep-polytinder-amount";

/* ── Page ───────────────────────────────────────── */
export default function PolyTinderPage() {
  const [cards, setCards] = useState<FeedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState(10);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());

  const isConnected = useUserStore((s) => s.isConnected);
  const walletAddress = useUserStore((s) => s.walletAddress);
  const { login, authenticated } = usePrivy();

  // Load persisted bet amount
  useEffect(() => {
    const saved = localStorage.getItem(LS_AMOUNT_KEY);
    if (saved) {
      const num = parseInt(saved, 10);
      if (BET_PRESETS.includes(num)) setBetAmount(num);
    }
  }, []);

  const handleBetChange = (amount: number) => {
    setBetAmount(amount);
    localStorage.setItem(LS_AMOUNT_KEY, String(amount));
  };

  const fetchCards = useCallback(async () => {
    try {
      const exclude = Array.from(seenIds).join(",");
      const params = new URLSearchParams({ limit: "50" });
      if (exclude) params.set("exclude", exclude);

      const res = await fetch(`/api/polytinder/feed?${params}`);
      const data = await res.json();

      if (data.cards && data.cards.length > 0) {
        setCards((prev) => {
          // Append new cards, dedup
          const existingIds = new Set(prev.map((c: FeedCard) => c.id));
          const newCards = data.cards.filter((c: FeedCard) => !existingIds.has(c.id));
          return [...prev, ...newCards];
        });
        // Track seen market_ids
        setSeenIds((prev) => {
          const next = new Set(prev);
          for (const c of data.cards) next.add(c.market_id);
          return next;
        });
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load markets");
    } finally {
      setLoading(false);
    }
  }, [seenIds]);

  useEffect(() => {
    fetchCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only fetch on mount

  const handleNeedMore = useCallback(() => {
    fetchCards();
  }, [fetchCards]);

  const handleReshuffle = useCallback((reshuffledCards: FeedCard[]) => {
    setCards(reshuffledCards);
  }, []);

  return (
    <div className="flex flex-col items-center h-[calc(100dvh-4rem)] sm:h-[calc(100dvh-5rem)] relative overflow-hidden">
      {/* ── Background Layers ── */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0"
        aria-hidden="true"
      >
        <span
          className="font-display text-[8rem] sm:text-[12rem] lg:text-[16rem] font-black uppercase tracking-widest whitespace-nowrap"
          style={{
            transform: 'rotate(-15deg)',
            color: 'rgba(255, 255, 255, 0.02)',
            userSelect: 'none',
          }}
        >
          POLYTINDER
        </span>
      </div>
      <div className="absolute inset-0 pointer-events-none z-0" aria-hidden="true">
        <div
          className="absolute -top-20 -right-20 w-80 h-80 rounded-full animate-pulse-slow"
          style={{
            background: 'radial-gradient(circle, rgba(0, 240, 160, 0.06) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        <div
          className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full animate-pulse-slow"
          style={{
            background: 'radial-gradient(circle, rgba(244, 114, 182, 0.04) 0%, transparent 70%)',
            filter: 'blur(60px)',
            animationDelay: '1s',
          }}
        />
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full animate-pulse-slow"
          style={{
            background: 'radial-gradient(circle, rgba(96, 165, 250, 0.03) 0%, transparent 70%)',
            filter: 'blur(80px)',
            animationDelay: '2s',
          }}
        />
      </div>

      {/* ── Content (above background) ── */}
      <div className="relative z-10 flex flex-col items-center w-full flex-1 min-h-0">

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center pt-2 pb-1 sm:mb-4 shrink-0"
      >
        <h1 className="font-display text-xl sm:text-3xl font-bold">
          Poly<span className="text-gradient">Tinder</span> <span className="text-xl sm:text-2xl">🔥</span>
        </h1>
        <p className="hidden sm:block text-sm sm:text-base text-text-secondary font-medium mt-1">
          Swipe right for YES, left for NO. Bet on the future.
        </p>
        <motion.p
          className="hidden sm:block text-xs text-text-muted/60 mt-0.5 italic"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          swipe through the duds to find the gems 💎
        </motion.p>
      </motion.div>

      {/* ── Bet Amount Selector ── */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-2 pb-2 sm:mb-4 shrink-0"
      >
        <span className="text-xs text-text-secondary font-medium mr-1">Bet:</span>
        {BET_PRESETS.map((amt) => (
          <button
            key={amt}
            onClick={() => handleBetChange(amt)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition ${
              betAmount === amt
                ? "bg-accent/15 text-accent border border-accent/30"
                : "bg-ep-surface/60 text-text-muted border border-ep-border/50 hover:text-text-secondary hover:border-ep-border"
            }`}
          >
            ${amt}
          </button>
        ))}
      </motion.div>

      {/* ── Login Prompt ── */}
      {!authenticated && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-4"
        >
          <button
            onClick={() => login()}
            className="px-4 py-2 rounded-xl bg-accent/10 text-accent border border-accent/20 text-xs font-semibold hover:bg-accent/20 transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            Log In to Place Bets
          </button>
        </motion.div>
      )}

      {/* ── Loading / Error / Cards ── */}
      {loading ? (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
            <p className="text-sm text-text-muted">Loading markets...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <div className="ep-card rounded-2xl p-8 text-center max-w-[340px]">
            <div className="text-4xl mb-3">😅</div>
            <h3 className="font-display font-semibold text-text-primary mb-2">Something went wrong</h3>
            <p className="text-sm text-text-muted mb-4">{error}</p>
            <button
              onClick={() => {
                setLoading(true);
                setError(null);
                fetchCards();
              }}
              className="btn-accent px-6 py-2 rounded-xl text-sm font-semibold"
            >
              Try Again
            </button>
          </div>
        </div>
      ) : cards.length === 0 ? (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <div className="ep-card rounded-2xl p-8 text-center max-w-[340px]">
            <div className="text-4xl mb-3">📊</div>
            <h3 className="font-display font-semibold text-text-primary mb-2">No markets yet</h3>
            <p className="text-sm text-text-muted">Markets are being loaded. Check back in a minute!</p>
          </div>
        </div>
      ) : (
        <SwipeCardStack
          cards={cards}
          onNeedMore={handleNeedMore}
          onReshuffle={handleReshuffle}
          defaultBetAmount={betAmount}
        />
      )}

      </div>{/* close z-10 content wrapper */}
    </div>
  );
}
