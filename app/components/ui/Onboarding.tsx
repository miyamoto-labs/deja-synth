'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '@/app/lib/stores/user-store';
import { useToast } from './Toast';
import { TierBadge } from './Badges';

/* ── Constants ───────────────────────────────────── */
const TOTAL_STEPS = 5;

/* ── Animation variants ──────────────────────────── */
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
};

const slideTransition = {
  x: { type: 'spring' as const, stiffness: 300, damping: 30 },
  opacity: { duration: 0.25 },
};

/* ── Step Indicator (progress dots) ──────────────── */
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-4">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          animate={{
            width: i === current ? 24 : 8,
            height: 8,
            backgroundColor:
              i === current
                ? '#00F0A0'
                : i < current
                  ? 'rgba(0, 240, 160, 0.4)'
                  : 'rgba(255, 255, 255, 0.1)',
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        />
      ))}
    </div>
  );
}

/* ── Navigation Footer ───────────────────────────── */
function NavigationFooter({
  step,
  total,
  onBack,
  onNext,
  onSkip,
}: {
  step: number;
  total: number;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const isLastStep = step === total - 1;

  return (
    <div className="flex items-center justify-between px-6 sm:px-8 py-4 border-t border-ep-border bg-ep-bg/50">
      <div>
        {step > 0 ? (
          <button onClick={onBack} className="btn-ghost px-4 py-2 text-xs rounded-lg">
            ← Back
          </button>
        ) : (
          <button
            onClick={onSkip}
            className="text-xs text-text-muted hover:text-text-secondary transition"
          >
            Skip setup
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        {step > 0 && !isLastStep && (
          <button
            onClick={onSkip}
            className="text-xs text-text-muted hover:text-text-secondary transition"
          >
            Skip
          </button>
        )}
        <motion.button
          onClick={onNext}
          className="btn-accent px-5 py-2 text-sm font-semibold rounded-lg"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {isLastStep ? 'Launch Dashboard →' : 'Next →'}
        </motion.button>
      </div>
    </div>
  );
}

/* ── Step 0: Welcome ─────────────────────────────── */
function Step0Welcome({
  direction,
  walletAddress,
}: {
  direction: number;
  walletAddress: string | null;
}) {
  const truncated = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : '';

  const valueProps = [
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: 'AI Picks',
      desc: 'Scored opportunities',
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
      label: 'Copy Trade',
      desc: 'Copy top traders',
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      label: 'Quick Trade',
      desc: 'One-click execution',
    },
  ];

  return (
    <motion.div
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={slideTransition}
      className="text-center space-y-6 py-4"
    >
      {/* Logo */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
      >
        <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight">
          Easy<span className="text-gradient">Poly</span>
        </h1>
      </motion.div>

      {/* Welcome message */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="space-y-2"
      >
        <h2 className="text-lg sm:text-xl font-display font-semibold text-text-primary">
          Welcome aboard
        </h2>
        {truncated && (
          <p className="text-sm font-mono text-accent">{truncated}</p>
        )}
        <p className="text-sm text-text-secondary max-w-sm mx-auto leading-relaxed">
          Your AI-powered trading command center for Polymarket.
          Let&apos;s get you set up in under a minute.
        </p>
      </motion.div>

      {/* Value props */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-3 gap-3 pt-2"
      >
        {valueProps.map((item, i) => (
          <div
            key={i}
            className="p-3 rounded-xl bg-ep-surface/60 border border-ep-border/50 text-center"
          >
            <div className="text-accent mb-1.5 flex justify-center">{item.icon}</div>
            <p className="text-xs font-semibold text-text-primary">{item.label}</p>
            <p className="text-[10px] text-text-muted mt-0.5">{item.desc}</p>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}

/* ── Step 1: Discover Command Center ─────────────── */
function Step1Discover({ direction }: { direction: number }) {
  const features = [
    {
      title: 'AI Picks',
      desc: 'Our engine scans 200+ markets every 5 minutes, scoring opportunities with conviction ratings from 0–100.',
      accent: true,
    },
    {
      title: 'Copy Signals',
      desc: 'Real-time alerts when traders you copy make moves. One click to copy their exact trade.',
      accent: false,
    },
    {
      title: 'Market Intelligence',
      desc: 'Win rates, P&L tracking, and performance analytics — all updated live on your dashboard.',
      accent: false,
    },
  ];

  return (
    <motion.div
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={slideTransition}
      className="space-y-5"
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <h2 className="text-lg font-display font-semibold">Command Center</h2>
        </div>
        <p className="text-sm text-text-secondary leading-relaxed">
          Your dashboard streams live AI-generated picks and copy signals from top Polymarket traders.
        </p>
      </div>

      <div className="space-y-3">
        {features.map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.1 }}
            className={`p-4 rounded-xl border ${
              feature.accent
                ? 'border-accent/20 bg-accent/5'
                : 'border-ep-border bg-ep-surface/40'
            }`}
          >
            <h3
              className={`text-sm font-semibold ${
                feature.accent ? 'text-accent' : 'text-text-primary'
              }`}
            >
              {feature.title}
            </h3>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              {feature.desc}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── Step 2: Follow Traders (Interactive) ────────── */
function Step2FollowTraders({
  direction,
  traders,
  loading,
  followedIds,
  onFollow,
}: {
  direction: number;
  traders: any[];
  loading: boolean;
  followedIds: string[];
  onFollow: (traderId: string) => void;
}) {
  return (
    <motion.div
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={slideTransition}
      className="space-y-5"
    >
      <div className="space-y-2">
        <h2 className="text-lg font-display font-semibold">Copy Top Traders</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          When these traders make moves, you&apos;ll get real-time copy signals on your dashboard.
        </p>
      </div>

      <div className="space-y-2 max-h-[280px] overflow-y-auto no-scrollbar">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="p-3 rounded-xl bg-ep-surface/40 border border-ep-border"
            >
              <div className="flex items-center gap-3 animate-pulse">
                <div className="w-9 h-9 rounded-full skeleton" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-24 skeleton rounded" />
                  <div className="h-2.5 w-16 skeleton rounded" />
                </div>
                <div className="h-7 w-16 skeleton rounded-lg" />
              </div>
            </div>
          ))
        ) : traders.length > 0 ? (
          traders.map((trader, i) => {
            const followed = followedIds.includes(trader.id);
            const roiColor =
              trader.roi > 0
                ? '#00F0A0'
                : trader.roi < 0
                  ? '#FF4060'
                  : '#8B92A8';

            return (
              <motion.div
                key={trader.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="p-3 rounded-xl bg-ep-surface/40 border border-ep-border hover:border-ep-border-bright transition"
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{
                      background: `${roiColor}15`,
                      color: roiColor,
                      border: `2px solid ${roiColor}30`,
                    }}
                  >
                    {(trader.alias || '?')[0]?.toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-text-primary truncate">
                        {trader.alias}
                      </span>
                      {trader.bankroll_tier && (
                        <TierBadge tier={trader.bankroll_tier} />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-text-muted mt-0.5">
                      <span>
                        ROI{' '}
                        <span className="font-mono" style={{ color: roiColor }}>
                          {trader.roi > 0 ? '+' : ''}
                          {trader.roi?.toFixed(0)}%
                        </span>
                      </span>
                      <span>
                        WR{' '}
                        <span className="font-mono">
                          {trader.win_rate?.toFixed(0)}%
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Follow button */}
                  <motion.button
                    onClick={() => onFollow(trader.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                      followed
                        ? 'bg-profit/10 text-profit border border-profit/20'
                        : 'bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20'
                    }`}
                    whileTap={{ scale: 0.95 }}
                  >
                    {followed ? '✓ Copying' : '+ Copy'}
                  </motion.button>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="p-6 text-center text-sm text-text-muted">
            No traders available right now. You can find them on the Traders page later.
          </div>
        )}
      </div>

      <p className="text-[10px] text-text-muted text-center">
        You can always manage your copied traders from the Traders page.
      </p>
    </motion.div>
  );
}

/* ── Step 3: Quick Trade Setup (Interactive) ─────── */
function Step3QuickTrade({
  direction,
  quickTradeEnabled,
  onToggleQuickTrade,
  customPresets,
  onUpdatePresets,
}: {
  direction: number;
  quickTradeEnabled: boolean;
  onToggleQuickTrade: () => void;
  customPresets: number[];
  onUpdatePresets: (presets: number[]) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [editPresets, setEditPresets] = useState(customPresets);

  return (
    <motion.div
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={slideTransition}
      className="space-y-5"
    >
      <div className="space-y-2">
        <h2 className="text-lg font-display font-semibold">Quick Trade</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          Enable one-click trading to execute instantly from preset buttons on any pick or signal.
        </p>
      </div>

      {/* Toggle card */}
      <div className="p-4 rounded-xl bg-ep-surface/40 border border-ep-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <span className="text-sm font-semibold text-text-primary">
              Quick Trade Mode
            </span>
          </div>
          <button
            onClick={onToggleQuickTrade}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              quickTradeEnabled ? 'bg-accent' : 'bg-ep-border'
            }`}
          >
            <motion.div
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
              animate={{ left: quickTradeEnabled ? 22 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
        <p className="text-xs text-text-muted mt-2">
          {quickTradeEnabled
            ? 'Quick trade is ON. Preset buttons will execute instantly.'
            : 'Quick trade is OFF. You can enable it anytime.'}
        </p>
      </div>

      {/* Preset amounts */}
      <div>
        <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 block">
          Trade Amounts
        </label>
        <div className="flex gap-2">
          {customPresets.map((preset, i) => (
            <div
              key={i}
              className="flex-1 py-2 rounded-lg text-center text-xs font-mono font-medium bg-ep-surface border border-ep-border text-text-secondary"
            >
              ${preset}
            </div>
          ))}
        </div>
        <button
          onClick={() => {
            setEditMode(!editMode);
            setEditPresets(customPresets);
          }}
          className="text-[10px] text-text-muted hover:text-accent transition mt-1.5"
        >
          {editMode ? 'Cancel' : 'Customize amounts'}
        </button>

        <AnimatePresence>
          {editMode && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex gap-1.5 mt-2">
                {editPresets.map((p, i) => (
                  <input
                    key={i}
                    type="number"
                    value={p}
                    onChange={(e) => {
                      const next = [...editPresets];
                      next[i] = Math.max(1, Math.min(1000, Number(e.target.value)));
                      setEditPresets(next);
                    }}
                    className="flex-1 w-0 px-1.5 py-1 text-[11px] font-mono text-center bg-ep-surface border border-ep-border rounded-md text-text-primary focus:outline-none focus:border-accent/40"
                    min={1}
                    max={1000}
                  />
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    onUpdatePresets(editPresets);
                    setEditMode(false);
                  }}
                  className="text-[10px] font-semibold text-accent hover:underline"
                >
                  Apply
                </button>
                <button
                  onClick={() => {
                    const defaults = [5, 10, 25, 50, 100];
                    setEditPresets(defaults);
                    onUpdatePresets(defaults);
                    setEditMode(false);
                  }}
                  className="text-[10px] text-text-muted hover:text-text-secondary"
                >
                  Reset defaults
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="text-[10px] text-text-muted text-center">
        You can change these settings anytime from the trade panel.
      </p>
    </motion.div>
  );
}

/* ── Step 4: Enable Auto-Trading (Private Key) ────── */
function Step4AutoTrading({
  direction,
  walletAddress,
  onKeySubmitted,
}: {
  direction: number;
  walletAddress: string | null;
  onKeySubmitted: () => void;
}) {
  const [privateKey, setPrivateKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!privateKey.trim() || !walletAddress) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/wallet/private-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          privateKey: privateKey.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save private key');
      }

      setSuccess(true);
      onKeySubmitted();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={slideTransition}
      className="space-y-5"
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h2 className="text-lg font-display font-semibold">Enable Auto-Trading</h2>
        </div>
        <p className="text-sm text-text-secondary leading-relaxed">
          Paste your wallet&apos;s private key to unlock <strong className="text-text-primary">instant arcade bets</strong> and{' '}
          <strong className="text-text-primary">auto-execution</strong> — no MetaMask popups per trade.
        </p>
      </div>

      {/* How to find it */}
      <div className="p-3 rounded-xl bg-ep-surface/40 border border-ep-border">
        <p className="text-xs font-semibold text-text-primary mb-1.5">How to export from MetaMask:</p>
        <ol className="text-xs text-text-secondary space-y-1 list-decimal list-inside">
          <li>Click ⋮ (three dots) next to your account</li>
          <li>Select &quot;Account Details&quot;</li>
          <li>Click &quot;Show Private Key&quot;</li>
          <li>Enter your MetaMask password</li>
          <li>Copy the key and paste below</li>
        </ol>
      </div>

      {/* Input */}
      {success ? (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center"
        >
          <svg className="w-8 h-8 text-emerald-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm font-semibold text-emerald-400">Auto-trading enabled!</p>
          <p className="text-xs text-text-muted mt-1">Arcade and standing orders are now active.</p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <input
              type="password"
              value={privateKey}
              onChange={(e) => { setPrivateKey(e.target.value); setError(null); }}
              placeholder="0x..."
              className="w-full px-4 py-3 rounded-xl bg-ep-surface border border-ep-border text-sm font-mono text-text-primary placeholder:text-text-muted/40 focus:border-accent/50 focus:outline-none transition"
              autoComplete="off"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <motion.button
            onClick={handleSubmit}
            disabled={!privateKey.trim() || submitting}
            className="w-full py-3 rounded-xl text-sm font-semibold bg-accent text-ep-bg hover:bg-accent/90 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            whileTap={{ scale: 0.98 }}
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-ep-bg/30 border-t-ep-bg rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            )}
            {submitting ? 'Encrypting...' : 'Save & Encrypt Key'}
          </motion.button>
        </div>
      )}

      {/* Security note */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-accent/5 border border-accent/15">
        <svg className="w-4 h-4 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <p className="text-[10px] text-text-muted leading-relaxed">
          Your key is encrypted with AES-256-GCM (military-grade) and stored alongside your existing API credentials.
          It&apos;s used only to sign Polymarket orders — never for ETH transfers.
        </p>
      </div>
    </motion.div>
  );
}

/* ── Step 4: Ready ───────────────────────────────── */
function Step4Ready({ direction }: { direction: number }) {
  const features = [
    'Unlimited AI picks',
    'Click-to-Bet Arcade',
    'Real-time Telegram alerts',
    'Copy trading from 116+ traders',
    'Standing orders & auto-execution',
  ];

  return (
    <motion.div
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={slideTransition}
      className="text-center space-y-5 py-4"
    >
      {/* Animated checkmark */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
        className="mx-auto w-16 h-16 rounded-full bg-accent/10 border-2 border-accent/30 flex items-center justify-center"
      >
        <svg
          className="w-8 h-8 text-accent"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <motion.path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          />
        </svg>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-1"
      >
        <h2 className="text-xl font-display font-bold text-text-primary">
          You&apos;re All Set!
        </h2>
        <p className="text-sm text-text-secondary max-w-xs mx-auto leading-relaxed">
          Everything is free during our beta. Explore the full platform.
        </p>
      </motion.div>

      {/* Features included */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="p-4 rounded-xl border border-accent/30 bg-accent/5 text-left"
      >
        <p className="text-xs font-semibold text-accent mb-3">Included free during beta:</p>
        <ul className="space-y-1.5">
          {features.map((feature, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.08 }}
              className="flex items-start gap-2 text-xs text-text-secondary"
            >
              <svg className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {feature}
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </motion.div>
  );
}

/* ── Main Onboarding Component ───────────────────── */
export function Onboarding() {
  const {
    walletAddress,
    isConnected,
    hasCompletedOnboarding,
    setOnboardingComplete,
    quickTradeEnabled,
    setQuickTradeEnabled,
    customPresets,
    setCustomPresets,
    followedTraderIds,
    fetchFollows,
  } = useUserStore();

  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [traders, setTraders] = useState<any[]>([]);
  const [loadingTraders, setLoadingTraders] = useState(false);

  const shouldShow = isConnected && !hasCompletedOnboarding;

  // Fetch top traders when reaching step 2
  useEffect(() => {
    if (step === 2 && traders.length === 0) {
      fetchTopTraders();
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTopTraders = async () => {
    setLoadingTraders(true);
    try {
      const res = await fetch('/api/dashboard/traders?sort=roi&limit=5');
      const data = await res.json();
      setTraders(data.traders || []);
    } catch {
      // Silent — step 2 shows fallback
    }
    setLoadingTraders(false);
  };

  // Lock body scroll when overlay is visible
  useEffect(() => {
    if (shouldShow) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [shouldShow]);

  const goNext = useCallback(() => {
    if (step === TOTAL_STEPS - 1) {
      handleComplete();
      return;
    }
    setDirection(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const handleComplete = useCallback(() => {
    setOnboardingComplete();
    toast(
      'success',
      'Welcome to Déjà!',
      'Explore the Command Center to find your first trade.'
    );
  }, [setOnboardingComplete, toast]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  const handleFollow = useCallback(
    async (traderId: string) => {
      if (!walletAddress) return;
      try {
        await fetch('/api/follows/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress, traderId, action: 'activate' }),
        });
        await fetchFollows();
      } catch {
        toast('error', 'Copy Failed', 'Could not copy trader. Try again.');
      }
    },
    [walletAddress, fetchFollows, toast]
  );

  if (!shouldShow) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      {/* Overlay container */}
      <motion.div
        className="fixed inset-0 z-[70] flex items-center justify-center p-4 overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="w-full max-w-lg my-auto">
          {/* Progress dots */}
          <StepIndicator current={step} total={TOTAL_STEPS} />

          {/* Card */}
          <div className="ep-card rounded-2xl overflow-hidden relative max-h-[85vh] flex flex-col">
            {/* Subtle gradient bg */}
            <div
              className="absolute inset-0 pointer-events-none opacity-30"
              style={{
                background:
                  'radial-gradient(ellipse at 50% 0%, rgba(0, 240, 160, 0.08) 0%, transparent 60%)',
              }}
            />

            {/* Step content */}
            <div className="relative z-10 p-6 sm:p-8 overflow-y-auto flex-1 min-h-0">
              <AnimatePresence mode="wait" custom={direction}>
                {step === 0 && (
                  <Step0Welcome
                    key="s0"
                    direction={direction}
                    walletAddress={walletAddress}
                  />
                )}
                {step === 1 && (
                  <Step1Discover key="s1" direction={direction} />
                )}
                {step === 2 && (
                  <Step2FollowTraders
                    key="s2"
                    direction={direction}
                    traders={traders}
                    loading={loadingTraders}
                    followedIds={followedTraderIds}
                    onFollow={handleFollow}
                  />
                )}
                {step === 3 && (
                  <Step3QuickTrade
                    key="s3"
                    direction={direction}
                    quickTradeEnabled={quickTradeEnabled}
                    onToggleQuickTrade={() =>
                      setQuickTradeEnabled(!quickTradeEnabled)
                    }
                    customPresets={customPresets}
                    onUpdatePresets={setCustomPresets}
                  />
                )}
                {step === 4 && (
                  <Step4Ready key="s4" direction={direction} />
                )}
              </AnimatePresence>
            </div>

            {/* Footer nav */}
            <NavigationFooter
              step={step}
              total={TOTAL_STEPS}
              onBack={goBack}
              onNext={goNext}
              onSkip={handleSkip}
            />
          </div>
        </div>
      </motion.div>
    </>
  );
}
