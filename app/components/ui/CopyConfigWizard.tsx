'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip } from './Tooltip';
import { useUserStore, type FollowRecord } from '@/app/lib/stores/user-store';
import { useToast } from './Toast';

/* ── Types ──────────────────────────────────────── */
interface CopyConfigTrader {
  id: string;
  alias?: string;
  wallet_address?: string;
  win_rate?: number;
  total_pnl?: number;
  roi?: number;
  bankroll_tier?: string;
  trading_style?: string;
}

interface CopyConfigWizardProps {
  trader: CopyConfigTrader;
  existingSettings?: FollowRecord | null;
  onComplete: () => void;
  onClose: () => void;
}

/* ── Helpers ─────────────────────────────────────── */
const AMOUNT_PRESETS = [5, 10, 25, 50, 100];
const PCT_PRESETS = [5, 10, 25, 50];
const MAX_DAILY_OPTIONS = [1, 3, 5, 10, 25, 50];

function formatPnl(val: number): string {
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

function HelpIcon({ tip, pos = 'top' }: { tip: string; pos?: 'top' | 'bottom' }) {
  return (
    <Tooltip content={tip} position={pos}>
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/5 text-[9px] text-text-muted cursor-help hover:bg-white/10 transition">?</span>
    </Tooltip>
  );
}

/* ── Component ──────────────────────────────────── */
export function CopyConfigWizard({ trader, existingSettings, onComplete, onClose }: CopyConfigWizardProps) {
  const { walletAddress, fetchFollows, copytradeWallet, generateCopytradeWallet } = useUserStore();
  const { toast } = useToast();
  const router = useRouter();

  const isEditing = !!existingSettings;
  const [tab, setTab] = useState<'quick' | 'advanced'>(isEditing ? 'advanced' : 'quick');
  const [saving, setSaving] = useState(false);

  /* ── Copytrade wallet setup state ── */
  const [showWalletSetup, setShowWalletSetup] = useState(false);
  const [checkingWallet, setCheckingWallet] = useState(!isEditing && !copytradeWallet);
  const [generatingWallet, setGeneratingWallet] = useState(false);
  const [newWalletAddress, setNewWalletAddress] = useState<string | null>(copytradeWallet);

  // Check server before showing wallet setup (copytradeWallet may not be hydrated yet)
  useEffect(() => {
    if (isEditing || copytradeWallet) {
      setCheckingWallet(false);
      return;
    }
    if (!walletAddress) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/wallet/status?address=${walletAddress}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            if (data.copytradeWallet) {
              setNewWalletAddress(data.copytradeWallet);
              setShowWalletSetup(false);
            } else {
              setShowWalletSetup(true);
            }
          }
        } else if (!cancelled) {
          setShowWalletSetup(true);
        }
      } catch {
        if (!cancelled) setShowWalletSetup(true);
      } finally {
        if (!cancelled) setCheckingWallet(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isEditing, copytradeWallet, walletAddress]);

  /* ── Quick Start state ── */
  const [sizingMode, setSizingMode] = useState<'fixed' | 'percentage'>(existingSettings?.sizingMode ?? 'fixed');
  const [fixedAmount, setFixedAmount] = useState(existingSettings?.amountPerTrade ?? 10);
  const [pctValue, setPctValue] = useState(existingSettings?.sizingValue ?? 10);
  const [maxDaily, setMaxDaily] = useState(existingSettings?.maxDailyTrades ?? 5);
  const [autoExecute, setAutoExecute] = useState(existingSettings?.autoTrade ?? true);

  /* ── Advanced state ── */
  const [copyBuy, setCopyBuy] = useState(existingSettings?.copyBuy ?? true);
  const [copySell, setCopySell] = useState(existingSettings?.copySell ?? false);
  const [maxPerTrade, setMaxPerTrade] = useState(existingSettings?.maxPerTrade?.toString() ?? '');
  const [minTradeSize, setMinTradeSize] = useState(existingSettings?.minTradeSize?.toString() ?? '');
  const [totalSpendLimit, setTotalSpendLimit] = useState(existingSettings?.totalSpendLimit?.toString() ?? '');
  const [maxPerMarket, setMaxPerMarket] = useState(existingSettings?.maxPerMarket?.toString() ?? '');
  const [slipBuy, setSlipBuy] = useState(existingSettings?.slippageBuyPct ?? 10);
  const [slipSell, setSlipSell] = useState(existingSettings?.slippageSellPct ?? 10);
  const [stopLossPct, setStopLossPct] = useState(existingSettings?.stopLossPct?.toString() ?? '');
  const [takeProfitPct, setTakeProfitPct] = useState(existingSettings?.takeProfitPct?.toString() ?? '');
  const [slBufferPct, setSlBufferPct] = useState(existingSettings?.slBufferPct ?? 15);

  /* ── API calls ── */
  const buildSettingsPayload = () => ({
    walletAddress,
    traderId: trader.id,
    auto_trade: autoExecute,
    amount_per_trade: sizingMode === 'fixed' ? fixedAmount : 10, // fallback for fixed
    max_daily_trades: maxDaily,
    sizing_mode: sizingMode,
    sizing_value: sizingMode === 'percentage' ? pctValue : fixedAmount,
    copy_buy: copyBuy,
    copy_sell: copySell,
    max_per_trade: maxPerTrade ? parseFloat(maxPerTrade) : null,
    min_trade_size: minTradeSize ? parseFloat(minTradeSize) : null,
    total_spend_limit: totalSpendLimit ? parseFloat(totalSpendLimit) : null,
    max_per_market: maxPerMarket ? parseFloat(maxPerMarket) : null,
    slippage_buy_pct: slipBuy,
    slippage_sell_pct: slipSell,
    stop_loss_pct: stopLossPct ? parseFloat(stopLossPct) : null,
    take_profit_pct: takeProfitPct ? parseFloat(takeProfitPct) : null,
    sl_buffer_pct: slBufferPct,
  });

  const handleStartCopying = async () => {
    if (!walletAddress) return;
    setSaving(true);
    try {
      // 1. Activate follow
      const toggleRes = await fetch('/api/follows/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, traderId: trader.id, action: 'activate' }),
      });
      const toggleData = await toggleRes.json();
      if (!toggleData.success) throw new Error(toggleData.error || 'Failed to activate follow');

      // 2. Save settings
      await fetch('/api/follows/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSettingsPayload()),
      });

      await fetchFollows();
      const name = trader.alias || trader.wallet_address?.slice(0, 10) || 'Trader';
      const modeLabel = autoExecute ? 'Auto-copying' : 'Following (manual)';
      const sizeLabel = sizingMode === 'percentage' ? `${pctValue}% of trades` : `$${fixedAmount}/trade`;
      toast('success', `${modeLabel} ${name}`, `${sizeLabel} · Opening Shadow page...`);
      onComplete();
      router.push(`/dashboard/shadow?trader=${trader.id}`);
    } catch (err: any) {
      toast('error', 'Copy Failed', err?.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleConfigLater = async () => {
    if (!walletAddress) return;
    setSaving(true);
    try {
      const res = await fetch('/api/follows/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, traderId: trader.id, action: 'shadow' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to add to Shadow');

      await fetchFollows();
      const name = trader.alias || trader.wallet_address?.slice(0, 10) || 'Trader';
      toast('info', `${name} added to Shadow`, 'Opening Shadow page...');
      onComplete();
      router.push(`/dashboard/shadow?trader=${trader.id}`);
    } catch (err: any) {
      toast('error', 'Failed', err?.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!walletAddress) return;
    setSaving(true);
    try {
      await fetch('/api/follows/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSettingsPayload()),
      });

      await fetchFollows();
      toast('success', 'Settings Saved', sizingMode === 'percentage' ? `${pctValue}% of trades` : `$${fixedAmount}/trade, max ${maxDaily}/day`);
      onComplete();
    } catch (err: any) {
      toast('error', 'Save Failed', err?.message || 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  const traderName = trader.alias || trader.wallet_address?.slice(0, 10) || 'Trader';

  const WALLET_STEPS = [
    'Generating wallet...',
    'Deriving trading credentials...',
    'Funding gas for approvals...',
    'Setting exchange approvals...',
    'Finalizing...',
  ];
  const [walletStep, setWalletStep] = useState(0);

  const handleGenerateWallet = async () => {
    setGeneratingWallet(true);
    setWalletStep(0);

    // Advance steps on a timer to show progress while the API works
    const stepTimings = [2000, 4000, 6000, 12000]; // ms before advancing to next step
    const timers: ReturnType<typeof setTimeout>[] = [];
    stepTimings.forEach((ms, i) => {
      timers.push(setTimeout(() => setWalletStep(i + 1), ms));
    });

    try {
      const addr = await generateCopytradeWallet();
      timers.forEach(clearTimeout);
      setWalletStep(WALLET_STEPS.length - 1);
      if (addr) {
        setNewWalletAddress(addr);
        toast('success', 'Copy-Trade Wallet Created', 'Deposit USDC (Polygon) to start trading');
        setShowWalletSetup(false);
      } else {
        toast('error', 'Failed', 'Could not create wallet. Please try again.');
      }
    } catch {
      timers.forEach(clearTimeout);
      toast('error', 'Error', 'Something went wrong creating your wallet.');
    } finally {
      setGeneratingWallet(false);
      setWalletStep(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <motion.div
        className="relative w-full max-w-md bg-ep-card border border-ep-border rounded-2xl shadow-2xl overflow-hidden"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        {/* ── Copytrade Wallet Setup Step ── */}
        {checkingWallet ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-accent border-t-transparent" />
          </div>
        ) : showWalletSetup ? (
          <>
            <div className="px-6 pt-5 pb-4 border-b border-ep-border/50">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-text-primary">
                  Set Up Copy Trading
                </h3>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="px-6 py-6 space-y-5">
              <div className="text-center space-y-3">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-accent/10 flex items-center justify-center">
                  <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-text-primary">Dedicated Trading Wallet</h4>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed max-w-xs mx-auto">
                    Copy trading requires a dedicated wallet for fast server-side execution.
                    We&apos;ll generate one for you — you can export your private key anytime.
                  </p>
                </div>
              </div>

              {newWalletAddress ? (
                <div className="space-y-3">
                  <div className="bg-white/5 rounded-xl p-4 border border-ep-border/50">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Deposit Address (Polygon USDC)</div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(newWalletAddress);
                          toast('success', 'Copied', 'Wallet address copied to clipboard');
                        }}
                        className="text-[10px] font-semibold text-accent hover:text-accent/80 transition"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="font-mono text-xs text-text-primary break-all select-all bg-black/20 rounded-lg px-3 py-2">{newWalletAddress}</div>
                  </div>
                  <div className="bg-accent/5 rounded-xl p-4 border border-accent/20 space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-accent">How to Fund</div>
                    <ol className="text-xs text-text-secondary leading-relaxed space-y-1 list-decimal list-inside">
                      <li>Send <span className="font-semibold text-text-primary">USDC</span> on the <span className="font-semibold text-text-primary">Polygon</span> network to the address above</li>
                      <li>Once funded, your copy trades will execute automatically</li>
                      <li>You can always find this address on the <span className="font-semibold text-text-primary">Shadow</span> page</li>
                    </ol>
                  </div>
                  <button
                    onClick={() => setShowWalletSetup(false)}
                    className="w-full py-3 rounded-xl font-bold text-sm transition bg-accent text-black hover:bg-accent/90"
                  >
                    Continue to Settings
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-white/5 rounded-xl p-4 border border-ep-border/50 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-accent text-sm mt-0.5">1.</span>
                      <p className="text-xs text-text-secondary">We generate a fresh wallet and store the key encrypted on our servers</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-accent text-sm mt-0.5">2.</span>
                      <p className="text-xs text-text-secondary">You deposit USDC (Polygon) to fund your copy trades</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-accent text-sm mt-0.5">3.</span>
                      <p className="text-xs text-text-secondary">Trades execute automatically in 2-3 seconds when your traders act</p>
                    </div>
                  </div>

                  {generatingWallet ? (
                    <div className="space-y-3">
                      {/* Progress bar */}
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-accent"
                          initial={{ width: '5%' }}
                          animate={{ width: `${Math.min(((walletStep + 1) / WALLET_STEPS.length) * 100, 95)}%` }}
                          transition={{ duration: 1, ease: 'easeOut' }}
                        />
                      </div>
                      {/* Step labels */}
                      <div className="space-y-1.5">
                        {WALLET_STEPS.map((label, i) => (
                          <div key={label} className={`flex items-center gap-2 text-xs transition-all duration-300 ${
                            i < walletStep ? 'text-profit' : i === walletStep ? 'text-text-primary' : 'text-text-muted/30'
                          }`}>
                            {i < walletStep ? (
                              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            ) : i === walletStep ? (
                              <div className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                              </div>
                            ) : (
                              <div className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                              </div>
                            )}
                            {label}
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-text-muted text-center">This usually takes 15-30 seconds</p>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={handleGenerateWallet}
                        className="w-full py-3 rounded-xl font-bold text-sm transition bg-accent text-black hover:bg-accent/90"
                      >
                        Create Copy-Trade Wallet
                      </button>
                      <button
                        onClick={onClose}
                        className="w-full py-2 text-xs text-text-muted hover:text-text-secondary transition"
                      >
                        Maybe Later
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
        <>
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-ep-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-accent/15 text-accent">
              {traderName[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-lg font-bold text-text-primary truncate">
                {isEditing ? `Edit ${traderName}` : `Copy ${traderName}`}
              </h3>
              <p className="text-xs text-text-muted">
                {trader.win_rate ? `${trader.win_rate.toFixed(0)}% win rate` : ''}
                {trader.total_pnl ? ` · ${formatPnl(trader.total_pnl)} PnL` : ''}
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 bg-white/5 rounded-lg p-0.5">
            {(['quick', 'advanced'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition ${
                  tab === t ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {t === 'quick' ? 'Quick Start' : 'Advanced'}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto space-y-5">
          <AnimatePresence mode="wait">
            {tab === 'quick' ? (
              <motion.div key="quick" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-5">
                {/* Sizing Mode Toggle */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Trade Sizing</span>
                    <HelpIcon tip="Fixed $ trades a set amount each time. % of Trader mirrors a percentage of the trader's actual position size." />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSizingMode('fixed')}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition border ${
                        sizingMode === 'fixed' ? 'bg-accent/15 text-accent border-accent/30' : 'bg-white/5 text-text-muted border-white/10 hover:border-white/20'
                      }`}
                    >
                      Fixed $
                    </button>
                    <button
                      onClick={() => setSizingMode('percentage')}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition border ${
                        sizingMode === 'percentage' ? 'bg-accent/15 text-accent border-accent/30' : 'bg-white/5 text-text-muted border-white/10 hover:border-white/20'
                      }`}
                    >
                      % of Trader
                    </button>
                  </div>
                </div>

                {/* Amount Input */}
                {sizingMode === 'fixed' ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Amount per trade</span>
                      <span className="text-xl font-bold font-mono text-accent">${fixedAmount}</span>
                    </div>
                    <input
                      type="range" min={1} max={250} step={1}
                      value={fixedAmount}
                      onChange={(e) => setFixedAmount(Number(e.target.value))}
                      className="w-full accent-accent"
                    />
                    <div className="flex gap-2 mt-2">
                      {AMOUNT_PRESETS.map((p) => (
                        <button
                          key={p}
                          onClick={() => setFixedAmount(p)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition border ${
                            fixedAmount === p ? 'bg-accent/15 text-accent border-accent/30' : 'bg-white/5 text-text-muted border-white/10'
                          }`}
                        >
                          ${p}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Copy percentage</span>
                        <HelpIcon tip="E.g. if the trader buys $500 and you set 10%, you'll buy $50." />
                      </div>
                      <span className="text-xl font-bold font-mono text-accent">{pctValue}%</span>
                    </div>
                    <input
                      type="range" min={1} max={100} step={1}
                      value={pctValue}
                      onChange={(e) => setPctValue(Number(e.target.value))}
                      className="w-full accent-accent"
                    />
                    <div className="flex gap-2 mt-2">
                      {PCT_PRESETS.map((p) => (
                        <button
                          key={p}
                          onClick={() => setPctValue(p)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition border ${
                            pctValue === p ? 'bg-accent/15 text-accent border-accent/30' : 'bg-white/5 text-text-muted border-white/10'
                          }`}
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Max Daily Trades */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Max trades per day</span>
                    <HelpIcon tip="Stop auto-copying after this many trades in a single day." />
                  </div>
                  <div className="flex gap-1.5">
                    {MAX_DAILY_OPTIONS.map((n) => (
                      <button
                        key={n}
                        onClick={() => setMaxDaily(n)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition border ${
                          maxDaily === n ? 'bg-accent/15 text-accent border-accent/30' : 'bg-white/5 text-text-muted border-white/10'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Execution Mode */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Execution Mode</span>
                    <HelpIcon tip="Auto-Execute places trades instantly when the trader acts. Manual mode shows you the signal first so you can decide." />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAutoExecute(true)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition border ${
                        autoExecute ? 'bg-accent/15 text-accent border-accent/30' : 'bg-white/5 text-text-muted border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span>Auto-Execute</span>
                        <span className="text-[9px] font-normal opacity-70">Instant copy</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setAutoExecute(false)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition border ${
                        !autoExecute ? 'bg-accent/15 text-accent border-accent/30' : 'bg-white/5 text-text-muted border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span>Manual</span>
                        <span className="text-[9px] font-normal opacity-70">Review first</span>
                      </div>
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="advanced" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-5">
                {/* Copy Direction */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Copy Actions</span>
                  </div>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 flex-1 p-3 rounded-lg border border-white/10 bg-white/5 cursor-pointer hover:bg-white/8 transition">
                      <input type="checkbox" checked={copyBuy} onChange={(e) => setCopyBuy(e.target.checked)} className="accent-accent w-4 h-4" />
                      <div>
                        <span className="text-sm font-semibold text-text-primary">Copy Buy</span>
                        <p className="text-[10px] text-text-muted">Mirror new positions</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 flex-1 p-3 rounded-lg border border-white/10 bg-white/5 cursor-pointer hover:bg-white/8 transition">
                      <input type="checkbox" checked={copySell} onChange={(e) => setCopySell(e.target.checked)} className="accent-accent w-4 h-4" />
                      <div>
                        <span className="text-sm font-semibold text-text-primary">Copy Sell</span>
                        <p className="text-[10px] text-text-muted">Mirror exits</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Trade Sizing */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Trade Sizing</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[10px] text-text-muted">Max per Trade</span>
                        <HelpIcon tip="Cap each individual trade at this dollar amount." pos="bottom" />
                      </div>
                      <input
                        type="number" placeholder="No limit" value={maxPerTrade}
                        onChange={(e) => setMaxPerTrade(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-accent/40 outline-none"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[10px] text-text-muted">Min Signal Size</span>
                        <HelpIcon tip="Ignore trades from this trader below this $ amount." pos="bottom" />
                      </div>
                      <input
                        type="number" placeholder="No filter" value={minTradeSize}
                        onChange={(e) => setMinTradeSize(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-accent/40 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Risk Limits */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Risk Limits</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[10px] text-text-muted">Total Spend Limit</span>
                        <HelpIcon tip="Stop auto-copying once you've spent this total amount copying this trader." pos="bottom" />
                      </div>
                      <input
                        type="number" placeholder="No limit" value={totalSpendLimit}
                        onChange={(e) => setTotalSpendLimit(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-accent/40 outline-none"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[10px] text-text-muted">Max per Market</span>
                        <HelpIcon tip="Maximum total exposure to any single market from this trader." pos="bottom" />
                      </div>
                      <input
                        type="number" placeholder="No limit" value={maxPerMarket}
                        onChange={(e) => setMaxPerMarket(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-accent/40 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Stop Loss / Take Profit */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Stop Loss / Take Profit</span>
                    <HelpIcon tip="Auto-sell positions when P&L hits these thresholds. Based on % change from your entry price. Leave empty to disable." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[10px] text-loss">Stop Loss %</span>
                        <HelpIcon tip="Auto-sell if your position drops by this % from entry price. E.g. 20% means sell if you're down 20%." pos="bottom" />
                      </div>
                      <input
                        type="number" placeholder="Disabled" min={1} max={95} value={stopLossPct}
                        onChange={(e) => setStopLossPct(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-loss/40 outline-none"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[10px] text-profit">Take Profit %</span>
                        <HelpIcon tip="Auto-sell if your position rises by this % from entry price. E.g. 50% means sell if you're up 50%." pos="bottom" />
                      </div>
                      <input
                        type="number" placeholder="Disabled" min={1} max={500} value={takeProfitPct}
                        onChange={(e) => setTakeProfitPct(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-profit/40 outline-none"
                      />
                    </div>
                  </div>
                  {stopLossPct && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-text-muted">SL Exit Buffer</span>
                          <HelpIcon tip={`Extra % below stop loss for limit order fill. E.g. SL at ${stopLossPct}% with ${slBufferPct}% buffer → sell limit at -${parseFloat(stopLossPct) + slBufferPct}%. Higher = more likely to fill but worse exit price.`} pos="bottom" />
                        </div>
                        <span className="text-xs font-mono text-loss">{slBufferPct}%</span>
                      </div>
                      <input
                        type="range" min={5} max={50} step={1}
                        value={slBufferPct}
                        onChange={(e) => setSlBufferPct(Number(e.target.value))}
                        className="w-full accent-loss"
                      />
                      <div className="flex justify-between text-[9px] text-text-muted mt-0.5">
                        <span>5% (tighter)</span>
                        <span>50% (safer fill)</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Slippage */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Slippage Tolerance</span>
                    <HelpIcon tip="Prediction market prices move fast. We recommend 10%+ for reliable auto-copy execution. Lower slippage often causes trades to fail." />
                  </div>
                  {(slipBuy < 10 || slipSell < 10) && (
                    <div className="mb-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-[11px] text-yellow-400">
                      ⚠️ Below 10% slippage often causes auto-copy trades to fail. Prices shift between signal detection and execution.
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-text-muted">Buy</span>
                        <span className={`text-xs font-mono ${slipBuy < 10 ? 'text-yellow-400' : 'text-accent'}`}>{slipBuy}%</span>
                      </div>
                      <input
                        type="range" min={1} max={20} step={1}
                        value={slipBuy}
                        onChange={(e) => setSlipBuy(Number(e.target.value))}
                        className="w-full accent-accent"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-text-muted">Sell</span>
                        <span className={`text-xs font-mono ${slipSell < 10 ? 'text-yellow-400' : 'text-accent'}`}>{slipSell}%</span>
                      </div>
                      <input
                        type="range" min={1} max={20} step={1}
                        value={slipSell}
                        onChange={(e) => setSlipSell(Number(e.target.value))}
                        className="w-full accent-accent"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 border-t border-ep-border/50 space-y-2">
          {isEditing ? (
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="w-full py-3 rounded-xl font-bold text-sm transition bg-accent text-black hover:bg-accent/90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          ) : (
            <>
              <button
                onClick={handleStartCopying}
                disabled={saving}
                className="w-full py-3 rounded-xl font-bold text-sm transition bg-accent text-black hover:bg-accent/90 disabled:opacity-50"
              >
                {saving ? 'Starting...' : autoExecute
                  ? (sizingMode === 'percentage' ? `Auto-Copy \u2014 ${pctValue}% of trades` : `Auto-Copy \u2014 $${fixedAmount}/trade`)
                  : (sizingMode === 'percentage' ? `Follow \u2014 ${pctValue}% (manual)` : `Follow \u2014 $${fixedAmount} (manual)`)}
              </button>
              <button
                onClick={handleConfigLater}
                disabled={saving}
                className="w-full py-2.5 rounded-xl font-semibold text-sm transition text-text-muted hover:text-text-secondary hover:bg-white/5 disabled:opacity-50"
              >
                Config Later \u2192 Shadow
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="w-full py-2 text-xs text-text-muted hover:text-text-secondary transition"
          >
            Cancel
          </button>
        </div>
        </>
        )}
      </motion.div>
    </div>
  );
}
