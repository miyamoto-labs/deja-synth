'use client';

import { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';

/* ── Types ─────────────────────────────────────── */
export interface FeedCard {
  id: string;
  type: 'pick' | 'analyzed' | 'market' | 'signal';
  market_id: string;
  question: string;
  category: string;
  volume: number;
  end_date: string | null;
  yes_price: number;
  no_price: number;
  yes_token: string;
  no_token: string;
  conviction_score: number | null;
  direction: string | null;
  edge_explanation: string | null;
  entry_price: number | null;
  target_price: number | null;
  risk_reward: number | null;
  pick_id: string | null;
  time_horizon: string | null;
  signal_id: string | null;
  trader_alias: string | null;
  trader_roi: number | null;
  trader_win_rate: number | null;
  trader_tier: string | null;
  signal_amount: number | null;
  signal_direction: string | null;
}

interface SwipeCardProps {
  card: FeedCard;
  onSwipe: (direction: 'left' | 'right' | 'up') => void;
  isTop: boolean;
  stackIndex: number;
  betAmount: number;
  onAmountChange: (amount: number) => void;
}

/* ── Helpers ───────────────────────────────────── */
const SWIPE_THRESHOLD = 120;
const BET_MIN = 1;
const BET_MAX = 250;
const amountPresets = [1, 5, 10, 25, 50, 100];

const categoryEmoji: Record<string, string> = {
  Politics: '🏛️',
  Sports: '⚽',
  Crypto: '₿',
  'Pop Culture': '🎬',
  Science: '🔬',
  Business: '💼',
  Technology: '🤖',
  Finance: '📈',
  Culture: '🎭',
};

function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `$${(vol / 1_000).toFixed(0)}K`;
  return `$${vol.toFixed(0)}`;
}

function timeRemaining(endDate: string | null): string {
  if (!endDate) return '';
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 30) return `${Math.floor(days / 30)}mo left`;
  if (days > 0) return `${days}d ${hours}h left`;
  return `${hours}h left`;
}

/** Top-edge glow color by card type */
function typeGlow(type: FeedCard['type']): string {
  switch (type) {
    case 'pick': return 'rgba(0,240,160,0.4)';
    case 'analyzed': return 'rgba(167,139,250,0.35)';
    case 'signal': return 'rgba(244,114,182,0.35)';
    default: return 'rgba(96,165,250,0.25)';
  }
}

/* ── Component ─────────────────────────────────── */
export function SwipeCard({ card, onSwipe, isTop, stackIndex, betAmount, onAmountChange }: SwipeCardProps) {
  const [exiting, setExiting] = useState(false);
  const [exitDir, setExitDir] = useState<'left' | 'right' | 'up' | null>(null);
  const hasVibrated = useRef(false);

  const x = useMotionValue(0);

  // Overlay opacities driven by drag position
  const yesOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const noOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);

  // Dynamic border glow based on drag direction
  const borderGlowRight = useTransform(x, [0, SWIPE_THRESHOLD], ['0px', '12px']);
  const borderGlowLeft = useTransform(x, [-SWIPE_THRESHOLD, 0], ['12px', '0px']);

  const handleDrag = (_: any, info: PanInfo) => {
    if (!hasVibrated.current) {
      if (Math.abs(info.offset.x) > SWIPE_THRESHOLD) {
        if (navigator.vibrate) navigator.vibrate(30);
        hasVibrated.current = true;
      }
    }
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    hasVibrated.current = false;

    if (info.offset.x > SWIPE_THRESHOLD) {
      setExiting(true);
      setExitDir('right');
      if (navigator.vibrate) navigator.vibrate(50);
      setTimeout(() => onSwipe('right'), 300);
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      setExiting(true);
      setExitDir('left');
      if (navigator.vibrate) navigator.vibrate(50);
      setTimeout(() => onSwipe('left'), 300);
    }
  };

  const exitVariants = {
    left: { x: -600, rotate: -25, opacity: 0, scale: 0.8, transition: { duration: 0.4, ease: 'easeIn' } },
    right: { x: 600, rotate: 25, opacity: 0, scale: 0.8, transition: { duration: 0.4, ease: 'easeIn' } },
    up: { y: -500, opacity: 0, scale: 0.9, transition: { duration: 0.3, ease: 'easeIn' } },
  };

  const tierColors: Record<string, string> = {
    micro: '#A78BFA',
    small: '#60A5FA',
    mid: '#FBBF24',
    whale: '#34D399',
  };

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        zIndex: 10 - stackIndex,
        pointerEvents: isTop ? 'auto' : 'none',
      }}
      initial={{ scale: 1 - stackIndex * 0.05, y: stackIndex * 12, opacity: stackIndex === 0 ? 1 : 0.7 }}
      animate={
        exiting && exitDir
          ? exitVariants[exitDir]
          : {
              scale: 1 - stackIndex * 0.05,
              y: stackIndex * 12,
              opacity: stackIndex === 0 ? 1 : 0.7 - stackIndex * 0.15,
            }
      }
      transition={
        exiting && exitDir
          ? undefined
          : { type: 'spring', stiffness: 300, damping: 25 }
      }
    >
      <motion.div
        drag={isTop && !exiting ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        style={{ x, rotate }}
        className="relative w-full max-w-[92vw] sm:max-w-[400px] h-full sm:min-h-[480px] rounded-2xl overflow-hidden select-none"
        whileTap={isTop ? { cursor: 'grabbing', scale: 1.02 } : {}}
      >
        {/* Card body with type-colored top glow */}
        <div
          className="h-full rounded-2xl border border-ep-border/60 flex flex-col relative overflow-hidden"
          style={{
            background: `linear-gradient(180deg, ${typeGlow(card.type)} 0%, rgba(14,15,23,0) 80px), var(--color-ep-card, #12131D)`,
          }}
        >
          {/* ── YES Overlay ── */}
          <motion.div
            className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl pointer-events-none"
            style={{
              opacity: yesOpacity,
              background: 'radial-gradient(circle at center, rgba(0, 240, 160, 0.25), rgba(0, 240, 160, 0.08))',
              border: '3px solid rgba(0, 240, 160, 0.6)',
              boxShadow: '0 0 40px rgba(0, 240, 160, 0.3), inset 0 0 40px rgba(0, 240, 160, 0.1)',
            }}
          >
            <div className="text-center">
              <span className="font-display text-6xl font-black text-profit drop-shadow-[0_0_20px_rgba(0,240,160,0.5)] tracking-wider">
                YES
              </span>
              <div className="text-profit/60 text-sm font-semibold mt-1">Swipe to buy YES</div>
            </div>
          </motion.div>

          {/* ── NO Overlay ── */}
          <motion.div
            className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl pointer-events-none"
            style={{
              opacity: noOpacity,
              background: 'radial-gradient(circle at center, rgba(255, 64, 96, 0.25), rgba(255, 64, 96, 0.08))',
              border: '3px solid rgba(255, 64, 96, 0.6)',
              boxShadow: '0 0 40px rgba(255, 64, 96, 0.3), inset 0 0 40px rgba(255, 64, 96, 0.1)',
            }}
          >
            <div className="text-center">
              <span className="font-display text-6xl font-black text-loss drop-shadow-[0_0_20px_rgba(255,64,96,0.5)] tracking-wider">
                NO
              </span>
              <div className="text-loss/60 text-sm font-semibold mt-1">Swipe to buy NO</div>
            </div>
          </motion.div>

          {/* ── Header: Type Badge + Category ── */}
          <div className="flex items-center justify-between p-3 pb-1.5 sm:p-4 sm:pb-2">
            <div className="flex items-center gap-2">
              {card.type === 'pick' && (
                <span className="bg-accent/20 text-accent text-[10px] font-bold px-2.5 py-1 rounded-md shadow-[0_0_8px_rgba(0,240,160,0.15)]">
                  AI PICK
                </span>
              )}
              {card.type === 'analyzed' && (
                <span className="bg-[#A78BFA]/20 text-[#A78BFA] text-[10px] font-bold px-2.5 py-1 rounded-md shadow-[0_0_8px_rgba(167,139,250,0.15)]">
                  AI ANALYZED
                </span>
              )}
              {card.type === 'signal' && (
                <span className="bg-[#F472B6]/20 text-[#F472B6] text-[10px] font-bold px-2.5 py-1 rounded-md">
                  COPY SIGNAL
                </span>
              )}
              {card.type === 'market' && (
                <span className="bg-[#60A5FA]/20 text-[#60A5FA] text-[10px] font-bold px-2.5 py-1 rounded-md">
                  HOT MARKET
                </span>
              )}
              <span className="text-xs text-text-muted">
                {categoryEmoji[card.category] || '📊'} {card.category || 'Other'}
              </span>
            </div>
            {card.end_date && (
              <span className="text-[10px] text-text-muted font-mono">
                {timeRemaining(card.end_date)}
              </span>
            )}
          </div>

          {/* ── Question ── */}
          <div className="flex-1 flex items-center px-3 py-0 sm:px-5 sm:py-3 min-h-0">
            <h2 className="font-display text-sm sm:text-2xl font-bold text-text-primary text-center leading-snug w-full line-clamp-3">
              {card.question}
            </h2>
          </div>

          {/* ── Prices — large and glowing ── */}
          <div className="flex items-center justify-center gap-6 sm:gap-8 px-4 pb-1 sm:px-5 sm:pb-3">
            <div className="text-center">
              <div className="font-mono text-xl sm:text-3xl font-black text-profit drop-shadow-[0_0_10px_rgba(0,240,160,0.3)]">
                {(card.yes_price * 100).toFixed(0)}¢
              </div>
              <div className="text-[9px] sm:text-xs text-profit/60 uppercase tracking-widest font-semibold">YES</div>
            </div>
            <div className="w-px h-6 sm:h-10 bg-gradient-to-b from-transparent via-ep-border to-transparent" />
            <div className="text-center">
              <div className="font-mono text-xl sm:text-3xl font-black text-loss drop-shadow-[0_0_10px_rgba(255,64,96,0.3)]">
                {(card.no_price * 100).toFixed(0)}¢
              </div>
              <div className="text-[9px] sm:text-xs text-loss/60 uppercase tracking-widest font-semibold">NO</div>
            </div>
          </div>

          {/* ── Bet Amount: Slider + Quick Picks ── */}
          <div
            className="px-3 pb-1 sm:px-5 sm:pb-2 space-y-0.5"
            onPointerDownCapture={(e) => e.stopPropagation()}
            onTouchStartCapture={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-bold text-accent w-14 text-center">
                ${betAmount}
              </span>
              <input
                type="range"
                min={BET_MIN}
                max={BET_MAX}
                step={1}
                value={betAmount}
                onChange={(e) => onAmountChange(Number(e.target.value))}
                className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer
                  bg-ep-border/60
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-accent
                  [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(0,240,160,0.5)]
                  [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5
                  [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:bg-accent
                  [&::-moz-range-thumb]:border-none
                  [&::-moz-range-thumb]:cursor-pointer"
                style={{ touchAction: 'none' }}
              />
            </div>
            <div className="flex items-center justify-center gap-1.5">
              {amountPresets.map((amt) => (
                <button
                  key={amt}
                  onClick={() => onAmountChange(amt)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold transition ${
                    betAmount === amt
                      ? 'bg-accent/15 text-accent border border-accent/30'
                      : 'bg-ep-surface/50 text-text-muted border border-ep-border/50 hover:text-text-secondary'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>
          </div>

          {/* ── Enrichment: Pick / Signal / Market info ── */}
          <div className="px-3 pb-2 sm:px-5 sm:pb-4 space-y-1">
            {/* AI Pick / Analyzed enrichment */}
            {(card.type === 'pick' || card.type === 'analyzed') && card.conviction_score && (
              <div className="flex items-center gap-2 justify-center">
                <div
                  className="px-2.5 py-1 rounded-lg text-xs font-bold"
                  style={{
                    color: card.conviction_score >= 85 ? '#00F0A0' : card.conviction_score >= 60 ? '#F0B000' : '#A78BFA',
                    background: card.conviction_score >= 85
                      ? 'rgba(0,240,160,0.15)'
                      : card.conviction_score >= 60
                        ? 'rgba(240,176,0,0.15)'
                        : 'rgba(167,139,250,0.15)',
                    boxShadow: card.conviction_score >= 85
                      ? '0 0 8px rgba(0,240,160,0.2)'
                      : card.conviction_score >= 60
                        ? '0 0 8px rgba(240,176,0,0.15)'
                        : '0 0 8px rgba(167,139,250,0.15)',
                  }}
                >
                  {card.conviction_score}%
                </div>
                {card.direction && (
                  <span className={`text-sm font-bold ${card.direction === 'YES' ? 'text-profit' : 'text-loss'}`}>
                    AI says {card.direction}
                  </span>
                )}
              </div>
            )}
            {(card.type === 'pick' || card.type === 'analyzed') && card.edge_explanation && (
              <p className="text-xs text-text-secondary text-center leading-relaxed line-clamp-2">
                {card.edge_explanation}
              </p>
            )}

            {/* Signal enrichment */}
            {card.type === 'signal' && card.trader_alias && (
              <div className="flex items-center justify-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={{
                    background: `${tierColors[card.trader_tier || ''] || '#8B92A8'}20`,
                    color: tierColors[card.trader_tier || ''] || '#8B92A8',
                  }}
                >
                  {(card.trader_alias || '?')[0]?.toUpperCase()}
                </div>
                <span className="text-sm font-semibold text-text-primary">{card.trader_alias}</span>
                {card.trader_roi != null && (
                  <span className="text-xs text-profit font-mono font-bold">
                    +{card.trader_roi.toFixed(0)}%
                  </span>
                )}
                {card.signal_direction && (
                  <span className={`text-xs font-bold ${card.signal_direction === 'YES' ? 'text-profit' : 'text-loss'}`}>
                    bought {card.signal_direction}
                  </span>
                )}
              </div>
            )}

            {/* Volume + R/R */}
            <div className="flex items-center justify-center gap-3 text-xs text-text-muted">
              <span>{formatVolume(card.volume)} vol</span>
              {card.risk_reward && (
                <>
                  <span className="text-ep-border">·</span>
                  <span>{card.risk_reward.toFixed(1)}x R/R</span>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
