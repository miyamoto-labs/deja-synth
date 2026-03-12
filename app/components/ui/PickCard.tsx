'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ConvictionGauge } from './ConvictionGauge';
import { StatusBadge, DirectionBadge } from './Badges';
import { ActionButton } from './ActionButton';
import { AskAI } from './AskAI';
import { Tooltip } from './Tooltip';
import { useTradePanel } from './TradePanel';
import { useToast } from './Toast';
import { useUserStore } from '@/app/lib/stores/user-store';

interface Pick {
  id: string;
  market_id: string;
  direction: string;
  conviction_score: number;
  entry_price: number;
  target_price: number;
  stop_loss: number;
  risk_reward: number;
  time_horizon: string;
  edge_explanation: string;
  telegram_summary: string;
  status: string;
  created_at: string;
  // Denormalized fields from scanner v3
  question?: string;
  category?: string;
  slug?: string;
  side?: string;
  price?: number;
  confidence?: string;
  composite_score?: number;
  tier?: string;
  token_id?: string;
  reasoning?: string;
  scores?: any;
  // Live prices from Gamma API (injected by picks page)
  live_yes_price?: number;
  live_no_price?: number;
  live_yes_token?: string;
  live_no_token?: string;
  // Legacy join (may be null)
  market?: {
    question: string;
    category: string;
    volume: number;
    liquidity: number;
    yes_price: number;
    no_price: number;
    yes_token: string;
    no_token: string;
  };
}

interface PickCardProps {
  pick: Pick;
  variant?: 'hero' | 'compact' | 'grid';
  className?: string;
  /** Show 🎲 speculative indicator (extreme price, missing data, or wild topic) */
  isSpeculative?: boolean;
}

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatUsd(val: number) {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

function fmtPrice(p: number) {
  if (p > 1) return `${p.toFixed(0)}`;
  const cents = p * 100;
  return cents > 95 || cents < 5 ? `${cents.toFixed(1)}` : `${cents.toFixed(0)}`;
}

/** Plain English summary: "Buy YES at 42c, target 65c" */
function plainEnglish(pick: Pick) {
  const dir = pick.direction;
  const entry = fmtPrice(pick.entry_price);
  const target = fmtPrice(pick.target_price);
  return `Buy ${dir} at ${entry}\u00A2 \u2192 target ${target}\u00A2`;
}

/** Confidence color classes */
function confidenceColor(score: number) {
  if (score >= 85) return 'bg-profit/15 text-profit border-profit/20';
  if (score >= 70) return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20';
  return 'bg-loss/15 text-loss border-loss/20';
}

export function PickCard({ pick, variant = 'hero', className = '', isSpeculative = false }: PickCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [quickAmount, setQuickAmount] = useState(10);
  const { openTrade } = useTradePanel();
  const { toast } = useToast();
  const { walletAddress, isConnected, hasCredentials } = useUserStore();
  // Use denormalized fields first, fall back to legacy join
  const market = pick.market;
  const questionText = pick.question || market?.question || formatSlug(pick.market_id);

  /** Convert "will-megaeth-airdrop-june" → "Will Megaeth Airdrop June" */
  function formatSlug(slug: string): string {
    return slug
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\s*\d{3,}[\s-]*\d{3,}[\s-]*\d{3,}.*$/, '') // Strip trailing numeric IDs
      .trim() || slug;
  }
  const categoryText = pick.category || market?.category || '';
  const hasLivePrice = pick.live_yes_price != null;
  // Prefer live prices from Gamma API, fall back to stale scan-time prices
  const yesPrice = pick.live_yes_price ?? pick.price ?? pick.entry_price ?? market?.yes_price ?? 0;
  const noPrice = pick.live_no_price ?? market?.no_price ?? (1 - yesPrice);
  
  // Price change detection for warning
  const currentPrice = pick.direction === 'YES' ? yesPrice : noPrice;
  const priceChanged = hasLivePrice && Math.abs(currentPrice - pick.entry_price) > 0.03; // 3¢ threshold
  const priceDirection = currentPrice > pick.entry_price ? 'up' : 'down';
  
  // Assign the known token_id to the correct side based on pick direction
  // Also use live tokens from Gamma API as fallback
  const yesToken = pick.direction === 'YES'
    ? (pick.token_id || pick.live_yes_token || market?.yes_token || '')
    : (pick.live_yes_token || market?.yes_token || '');
  const noToken = pick.direction === 'NO'
    ? (pick.token_id || pick.live_no_token || market?.no_token || '')
    : (pick.live_no_token || market?.no_token || '');

  const pickPayload = {
    id: pick.id,
    market_id: pick.market_id,
    slug: pick.slug || undefined,
    direction: pick.direction,
    conviction_score: pick.conviction_score,
    entry_price: pick.entry_price,
    target_price: pick.target_price,
    stop_loss: pick.stop_loss,
    risk_reward: pick.risk_reward,
    edge_explanation: pick.edge_explanation,
    market: {
      question: questionText,
      yes_price: yesPrice,
      no_price: noPrice,
      yes_token: yesToken,
      no_token: noToken,
    },
  };

  const handleQuickBuy = (amt: number) => {
    openTrade({
      type: 'pick',
      pick: pickPayload,
      side: pick.direction as 'YES' | 'NO',
      initialAmount: amt,
    });
  };

  const handleBet = (side: 'YES' | 'NO') => {
    openTrade({
      type: 'pick',
      pick: pickPayload,
      side,
    });
  };

  /* ── Grid variant (card box) ────────────── */
  if (variant === 'grid') {
    return (
      <motion.div
        className={`ep-card overflow-hidden flex flex-col ${isSpeculative ? 'ring-1 ring-purple-500/20' : ''} ${className}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Top: badges + time */}
        <div className="p-4 pb-2">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <StatusBadge status={pick.status} />
            {isSpeculative && (
              <span className="text-sm" title="Speculative pick — unusual market conditions">🎲</span>
            )}
            {categoryText && (
              <span className="text-[10px] text-text-muted uppercase tracking-wider">
                {categoryText}
              </span>
            )}
            <span className="text-xs text-text-muted ml-auto">{timeAgo(pick.created_at)}</span>
          </div>

          {/* Market question */}
          <h3 className="font-display text-sm font-semibold text-text-primary leading-tight line-clamp-2">
            {questionText}
          </h3>

          {/* Conviction bar */}
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${confidenceColor(pick.conviction_score)}`}>
              {pick.conviction_score}%
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-ep-border/50 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  pick.conviction_score >= 85 ? 'bg-profit' :
                  pick.conviction_score >= 70 ? 'bg-yellow-400' : 'bg-loss'
                }`}
                style={{ width: `${pick.conviction_score}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stats mini-grid */}
        <div className="grid grid-cols-3 gap-px bg-ep-border/30 mx-4 rounded-lg overflow-hidden">
          {[
            { label: hasLivePrice ? 'Price' : 'Entry', value: `${fmtPrice(pick.direction === 'YES' ? yesPrice : noPrice)}\u00A2`, live: hasLivePrice },
            { label: 'Target', value: `${fmtPrice(pick.target_price)}\u00A2`, live: false },
            { label: 'R/R', value: `${pick.risk_reward?.toFixed(1) || '—'}x`, live: false },
          ].map((stat) => (
            <div key={stat.label} className="bg-ep-surface/40 p-2 text-center">
              <div className="text-[10px] text-text-muted uppercase tracking-wider flex items-center justify-center gap-1">
                {stat.live && <span className="h-1.5 w-1.5 rounded-full bg-profit animate-pulse" />}
                {stat.label}
              </div>
              <div className="font-mono text-xs font-semibold text-text-primary mt-0.5">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between p-3 mt-auto">
          <DirectionBadge direction={pick.direction} />
          <ActionButton
            variant={pick.direction === 'YES' ? 'yes' : 'no'}
            size="sm"
            onClick={() => handleBet(pick.direction as 'YES' | 'NO')}
          >
            Bet {pick.direction} at {fmtPrice(currentPrice)}&cent;
          </ActionButton>
        </div>
      </motion.div>
    );
  }

  /* ── Compact variant ─────────────────────── */
  if (variant === 'compact') {
    return (
      <motion.div
        className={`ep-card p-4 cursor-pointer ${isSpeculative ? 'ring-1 ring-purple-500/20' : ''} ${className}`}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {/* Confidence pill instead of gauge */}
          <span className={`text-xs font-bold px-2 py-1 rounded-lg border shrink-0 ${confidenceColor(pick.conviction_score)}`}>
            {pick.conviction_score}%
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">
              {isSpeculative && <span className="mr-1" title="Speculative">🎲</span>}
              {questionText}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <DirectionBadge direction={pick.direction} />
              <StatusBadge status={pick.status} />
              <span className="text-[11px] text-text-muted">{plainEnglish(pick)}</span>
            </div>
          </div>
          <span className="text-xs text-text-muted shrink-0">{timeAgo(pick.created_at)}</span>
        </div>

        {/* Expandable action row */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 pt-3 mt-3 border-t border-ep-border">
                <ActionButton
                  variant={pick.direction === 'YES' ? 'yes' : 'no'}
                  size="sm"
                  fullWidth
                  onClick={(e) => { e.stopPropagation(); handleBet(pick.direction as 'YES' | 'NO'); }}
                >
                  Bet {pick.direction}
                </ActionButton>
                <button
                  onClick={(e) => { e.stopPropagation(); handleBet(pick.direction === 'YES' ? 'NO' : 'YES'); }}
                  className="btn-ghost px-3 py-2 text-xs shrink-0"
                >
                  or {pick.direction === 'YES' ? 'NO' : 'YES'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  /* ── Hero variant ────────────────────────── */
  return (
    <motion.div
      className={`ep-card overflow-hidden ${isSpeculative ? 'ring-1 ring-purple-500/20' : ''} ${className}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      layout
    >
      {/* ── Zone 1: The Headline ─────────────── */}
      <div className="p-4 sm:p-5 pb-0">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Status + category row */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <StatusBadge status={pick.status} />
              {isSpeculative && (
                <span className="text-sm" title="Speculative pick — unusual market conditions">🎲</span>
              )}
              {categoryText && (
                <span className="text-[10px] text-text-muted uppercase tracking-wider">
                  {categoryText}
                </span>
              )}
              <span className="text-xs text-text-muted ml-auto">{timeAgo(pick.created_at)}</span>
            </div>

            {/* Market question */}
            <h3 className="font-display text-base sm:text-lg font-semibold text-text-primary leading-tight">
              {questionText}
            </h3>

            {/* Plain English summary */}
            <p className="text-sm text-accent font-medium mt-2">
              {plainEnglish(pick)}
            </p>

            {/* Telegram summary (1-liner AI take) */}
            {pick.telegram_summary && (
              <p className="text-sm text-text-secondary mt-1.5 line-clamp-2">
                {pick.telegram_summary}
              </p>
            )}
          </div>

          {/* Confidence pill (top-right) */}
          <div className="shrink-0 text-center">
            <div className={`text-lg font-bold px-3 py-1.5 rounded-xl border ${confidenceColor(pick.conviction_score)}`}>
              {pick.conviction_score}%
            </div>
            <div className="text-[10px] text-text-muted mt-1">confidence</div>
          </div>
        </div>
      </div>

      {/* ── Zone 2: The Action ───────────────── */}
      <div className="p-4 sm:p-5 pt-4 space-y-2">
        {/* Price change warning */}
        {priceChanged && (
          <div className="text-xs bg-yellow-500/10 text-yellow-400 px-3 py-2 rounded-lg border border-yellow-500/20 flex items-center gap-2">
            <span>⚠️</span>
            <span>Price moved {priceDirection} {Math.abs((currentPrice - pick.entry_price) * 100).toFixed(0)}¢ since pick was created</span>
          </div>
        )}
        
        {/* Primary CTA: bet the recommended direction */}
        <ActionButton
          variant={pick.direction === 'YES' ? 'yes' : 'no'}
          size="md"
          fullWidth
          onClick={() => handleBet(pick.direction as 'YES' | 'NO')}
        >
          Bet {pick.direction} at {fmtPrice(currentPrice)}&cent;
        </ActionButton>

        {/* Secondary: opposite direction + details toggle */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => handleBet(pick.direction === 'YES' ? 'NO' : 'YES')}
            className="text-xs text-text-muted hover:text-text-secondary transition"
          >
            or bet {pick.direction === 'YES' ? 'NO' : 'YES'}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-accent hover:text-accent/80 transition flex items-center gap-1"
          >
            {expanded ? 'Hide' : 'See'} AI Analysis
            <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Quick Buy row with slider — only when wallet connected + active */}
        {isConnected && hasCredentials && pick.status === 'active' && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-bold text-accent w-14 text-center">
                ${quickAmount}
              </span>
              <input
                type="range"
                min={1}
                max={250}
                step={1}
                value={quickAmount}
                onChange={(e) => setQuickAmount(Number(e.target.value))}
                className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer
                  bg-ep-border/60
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-accent
                  [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,240,160,0.4)]
                  [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5
                  [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:bg-accent
                  [&::-moz-range-thumb]:border-none
                  [&::-moz-range-thumb]:cursor-pointer"
              />
              <button
                onClick={() => handleQuickBuy(quickAmount)}
                className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-accent/15 text-accent border border-accent/25 hover:bg-accent/25 transition"
              >
                Buy
              </button>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              {[5, 10, 25, 50, 100].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setQuickAmount(amt)}
                  className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded-md transition ${
                    quickAmount === amt
                      ? 'bg-accent/15 text-accent border border-accent/30'
                      : 'bg-ep-surface/50 text-text-muted border border-ep-border/50 hover:text-text-secondary'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Zone 3: Expandable Details ───────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-ep-border">
              {/* Full conviction gauge */}
              <div className="flex items-center gap-4 px-4 sm:px-5 pt-4">
                <ConvictionGauge score={pick.conviction_score} size="lg" />
                <div className="flex-1">
                  <div className="text-xs text-text-muted uppercase tracking-wider mb-1">AI Confidence</div>
                  <div className="text-sm text-text-secondary">
                    {pick.conviction_score >= 85 ? 'Very high confidence — strong edge detected' :
                     pick.conviction_score >= 70 ? 'High confidence — notable edge detected' :
                     'Moderate confidence — edge exists but with uncertainty'}
                  </div>
                </div>
              </div>

              {/* Stats Grid with tooltips */}
              <div className="grid grid-cols-5 gap-px bg-ep-border/50 mx-4 sm:mx-5 mt-4 rounded-lg overflow-hidden">
                {[
                  { label: hasLivePrice ? 'Live' : 'Entry', value: `${fmtPrice(hasLivePrice ? (pick.direction === 'YES' ? yesPrice : noPrice) : pick.entry_price)}\u00A2`, tip: hasLivePrice ? 'Current live market price' : 'Price our AI recommends buying at', live: hasLivePrice },
                  { label: 'Target', value: `${fmtPrice(pick.target_price)}\u00A2`, tip: 'Expected profit-taking price', live: false },
                  { label: 'Stop', value: `${fmtPrice(pick.stop_loss)}\u00A2`, tip: 'Exit price to limit losses', live: false },
                  { label: 'R/R', value: `${pick.risk_reward?.toFixed(1)}x`, tip: 'Potential gain vs. loss. Higher = better', live: false },
                  { label: 'Horizon', value: pick.time_horizon, tip: 'Expected trade duration', live: false },
                ].map((stat) => (
                  <Tooltip key={stat.label} content={stat.tip}>
                    <div className="bg-ep-surface/50 p-3 text-center w-full cursor-help">
                      <div className="text-[10px] text-text-muted uppercase tracking-wider flex items-center justify-center gap-1">
                        {stat.live && <span className="h-1.5 w-1.5 rounded-full bg-profit animate-pulse" />}
                        {stat.label}
                      </div>
                      <div className="font-mono text-sm font-semibold text-text-primary mt-0.5">{stat.value}</div>
                    </div>
                  </Tooltip>
                ))}
              </div>

              {/* Volume / Liquidity */}
              <div className="flex items-center gap-4 px-4 sm:px-5 mt-3 text-xs text-text-muted">
                <span>Vol {formatUsd(market?.volume || 0)}</span>
                <span>Liq {formatUsd(market?.liquidity || 0)}</span>
                {pick.tier && <span>Tier {pick.tier}</span>}
                {pick.composite_score && <span>Score {pick.composite_score}</span>}
              </div>

              {/* Edge explanation */}
              {pick.edge_explanation && (
                <div className="px-4 sm:px-5 py-3 mt-2">
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">
                    Why this pick?
                  </p>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {pick.edge_explanation}
                  </p>
                </div>
              )}

              {/* Ask AI */}
              {pick.status === 'active' && (
                <div className="px-4 sm:px-5 pb-4">
                  <AskAI
                    contextPrompt={`Analyze the market: "${questionText}". Current YES price: ${(yesPrice * 100).toFixed(0)}c, NO price: ${(noPrice * 100).toFixed(0)}c. Our pick direction is ${pick.direction} at entry ${(pick.entry_price * 100).toFixed(0)}c with target ${(pick.target_price * 100).toFixed(0)}c. Conviction score: ${pick.conviction_score}/100. What's your assessment?`}
                    marketQuestion={questionText}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
