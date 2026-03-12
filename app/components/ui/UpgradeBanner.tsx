"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useUserStore } from "@/app/lib/stores/user-store";
import { useState, useEffect, useCallback } from "react";

/* ── USDC Icon ── */
function USDCIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#2775CA" />
      <path
        d="M20.5 18.5c0-2-1.2-2.7-3.5-3-.9-.2-1.8-.3-1.8-1.1 0-.7.5-1 1.4-1 .8 0 1.3.3 1.5.9.1.1.2.2.3.2h.9c.2 0 .3-.1.3-.3-.3-1-1-1.7-2-1.9v-1.1c0-.2-.1-.3-.3-.3h-.7c-.2 0-.3.1-.3.3v1.1c-1.3.2-2.1 1.1-2.1 2.2 0 1.9 1.2 2.6 3.5 2.9.9.2 1.8.5 1.8 1.2 0 .8-.7 1.2-1.5 1.2-1 0-1.5-.4-1.7-1.1 0-.1-.2-.2-.3-.2h-.9c-.2 0-.3.1-.3.3.3 1.2 1 1.9 2.3 2.1v1.1c0 .2.1.3.3.3h.7c.2 0 .3-.1.3-.3v-1.1c1.3-.3 2.2-1.2 2.2-2.3z"
        fill="white"
      />
      <path
        d="M13.2 24.3c-4.1-1.5-6.3-6-4.8-10.2 .8-2.2 2.6-3.9 4.8-4.7.2-.1.3-.2.3-.4v-.8c0-.2-.1-.3-.3-.3-.1 0-.1 0-.2 0-5 1.6-7.7 6.9-6.1 11.9 1 3 3.3 5.3 6.3 6.3.2.1.4 0 .4-.2v-.8c0-.2-.1-.3-.4-.4v-.4zm5.6-16c-.2-.1-.4 0-.4.2v.8c0 .2.2.3.4.4 4.1 1.5 6.3 6 4.8 10.2-.8 2.2-2.6 3.9-4.8 4.7-.2.1-.3.2-.3.4v.8c0 .2.1.3.3.3h.2c5-1.6 7.7-6.9 6.1-11.9-1-3-3.3-5.3-6.3-6.3v.4z"
        fill="white"
      />
    </svg>
  );
}

/* ── Stripe / Card Icon ── */
function CardIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  );
}

/* ── Copy Icon ── */
function CopyIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
    </svg>
  );
}

/* ── Check circle ── */
function CheckCircle({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

/* ── USDC Payment Modal ── */
function USDCPaymentModal({
  paymentId,
  amount,
  receivingWallet,
  onClose,
  onVerified,
}: {
  paymentId: string;
  amount: string;
  receivingWallet: string;
  onClose: () => void;
  onVerified: () => void;
}) {
  const [copied, setCopied] = useState<"address" | "amount" | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [status, setStatus] = useState<"pending" | "confirmed" | "expired">("pending");
  const [pollCount, setPollCount] = useState(0);

  const copyToClipboard = async (text: string, type: "address" | "amount") => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  // Auto-poll for payment every 15 seconds
  const checkPayment = useCallback(async () => {
    setVerifying(true);
    try {
      const res = await fetch("/api/usdc/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      });
      const data = await res.json();

      if (data.verified) {
        setStatus("confirmed");
        onVerified();
      } else if (data.status === "expired") {
        setStatus("expired");
      }
    } catch {
      // keep polling
    } finally {
      setVerifying(false);
    }
  }, [paymentId, onVerified]);

  useEffect(() => {
    if (status !== "pending") return;

    const interval = setInterval(() => {
      setPollCount((c) => c + 1);
      checkPayment();
    }, 15000);

    return () => clearInterval(interval);
  }, [status, checkPayment]);

  const shortAddr = `${receivingWallet.slice(0, 6)}...${receivingWallet.slice(-4)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="ep-card p-6 sm:p-8 max-w-md w-full space-y-5 border-accent/20 relative"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {status === "confirmed" ? (
          /* ── Success state — guide to Telegram trading setup ── */
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-profit/10 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-profit" />
            </div>
            <h3 className="font-display text-xl font-bold text-text-primary">
              Pro Activated!
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Set up your Telegram trading wallet to start betting from picks:
            </p>
            <div className="bg-ep-surface rounded-xl p-3 space-y-2 text-left">
              <div className="flex items-start gap-2.5">
                <span className="shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent text-[10px] font-bold flex items-center justify-center">1</span>
                <p className="text-xs text-text-secondary">Open the bot &amp; tap <strong className="text-text-primary">Create Trading Wallet</strong></p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent text-[10px] font-bold flex items-center justify-center">2</span>
                <p className="text-xs text-text-secondary">Fund with USDC on Polygon — done!</p>
              </div>
            </div>
            <a
              href="https://t.me/EasypolyQuickbot?start=setup_wallet"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 rounded-xl bg-accent text-ep-bg font-bold text-sm hover:bg-accent/90 transition flex items-center justify-center gap-2"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161l-1.97 9.291c-.145.658-.537.818-1.084.508l-3-2.211-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.334-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.932z" />
              </svg>
              Open Déjà Bot
            </a>
            <button
              onClick={onClose}
              className="w-full py-2 rounded-xl text-text-muted text-xs hover:text-text-secondary transition"
            >
              I&apos;ll do this later
            </button>
          </div>
        ) : status === "expired" ? (
          /* ── Expired state ── */
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-loss/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-loss" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="font-display text-xl font-bold text-text-primary">
              Payment Expired
            </h3>
            <p className="text-sm text-text-secondary">
              The payment window has expired. Please try again.
            </p>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-ep-surface border border-ep-border text-text-primary font-bold text-sm hover:bg-ep-border/50 transition"
            >
              Close
            </button>
          </div>
        ) : (
          /* ── Pending payment state ── */
          <>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#2775CA]/10 flex items-center justify-center mb-3">
                <USDCIcon className="w-7 h-7" />
              </div>
              <h3 className="font-display text-xl font-bold text-text-primary">
                Pay with USDC
              </h3>
              <p className="text-xs text-text-muted mt-1">Polygon network</p>
            </div>

            {/* Amount */}
            <div className="bg-ep-surface rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted uppercase tracking-wider">Amount</span>
                <button
                  onClick={() => copyToClipboard(amount, "amount")}
                  className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition"
                >
                  {copied === "amount" ? (
                    <><CheckCircle className="w-3.5 h-3.5" /> Copied</>
                  ) : (
                    <><CopyIcon /> Copy</>
                  )}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <USDCIcon className="w-5 h-5" />
                <span className="font-mono text-xl font-bold text-text-primary">{amount}</span>
                <span className="text-sm text-text-muted">USDC</span>
              </div>
            </div>

            {/* Wallet address */}
            <div className="bg-ep-surface rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted uppercase tracking-wider">Send to</span>
                <button
                  onClick={() => copyToClipboard(receivingWallet, "address")}
                  className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition"
                >
                  {copied === "address" ? (
                    <><CheckCircle className="w-3.5 h-3.5" /> Copied</>
                  ) : (
                    <><CopyIcon /> Copy</>
                  )}
                </button>
              </div>
              <div className="font-mono text-sm text-text-primary break-all leading-relaxed">
                {receivingWallet}
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#8247E5]" />
                <span className="text-xs text-text-muted">Polygon Network</span>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-conviction-medium/5 border border-conviction-medium/20 rounded-xl p-3 flex items-start gap-2.5">
              <svg className="w-4 h-4 text-conviction-medium shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-xs text-text-secondary leading-relaxed">
                Send <strong>exactly</strong> {amount} USDC on <strong>Polygon</strong>. Wrong amount or wrong chain may result in lost funds.
              </p>
            </div>

            {/* Polling status */}
            <div className="flex items-center justify-center gap-2 py-1">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse [animation-delay:200ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse [animation-delay:400ms]" />
              </div>
              <span className="text-xs text-text-muted">
                {verifying ? "Checking..." : "Waiting for payment..."}
              </span>
            </div>

            {/* Manual check button */}
            <button
              onClick={checkPayment}
              disabled={verifying}
              className="w-full py-2.5 rounded-xl bg-ep-surface border border-ep-border text-text-primary font-medium text-sm hover:bg-ep-border/50 transition disabled:opacity-50"
            >
              {verifying ? "Checking..." : "I've sent the payment"}
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}

/**
 * UpgradeBanner — shown to free-tier users when they've hit
 * their daily pick limit or when viewing Pro-gated features.
 * Supports both Stripe (Card/Apple Pay) and USDC payment.
 */
export function UpgradeBanner({
  picksUsed = 0,
  picksLimit = 3,
  variant = "inline",
}: {
  picksUsed?: number;
  picksLimit?: number;
  variant?: "inline" | "modal";
}) {
  const { walletAddress, isPro, fetchSubscription } = useUserStore();
  const [stripeLoading, setStripeLoading] = useState(false);
  const [usdcLoading, setUsdcLoading] = useState(false);

  // USDC payment modal state
  const [usdcPayment, setUsdcPayment] = useState<{
    paymentId: string;
    amount: string;
    receivingWallet: string;
  } | null>(null);

  if (isPro) return null;

  const atLimit = picksUsed >= picksLimit;

  /* ── Stripe checkout ── */
  const handleStripeUpgrade = async () => {
    if (!walletAddress) return;
    setStripeLoading(true);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletAddress, tier: "pro" }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("No checkout URL returned:", data);
      }
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setStripeLoading(false);
    }
  };

  /* ── USDC checkout ── */
  const handleUsdcUpgrade = async () => {
    if (!walletAddress) return;
    setUsdcLoading(true);

    try {
      const res = await fetch("/api/usdc/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletAddress, tier: "pro" }),
      });

      const data = await res.json();

      if (data.paymentId) {
        setUsdcPayment({
          paymentId: data.paymentId,
          amount: data.amount,
          receivingWallet: data.receivingWallet,
        });
      } else {
        console.error("USDC checkout failed:", data);
      }
    } catch (err) {
      console.error("USDC checkout error:", err);
    } finally {
      setUsdcLoading(false);
    }
  };

  const handleUsdcVerified = () => {
    // Refresh subscription state
    fetchSubscription();
  };

  /* ── Modal variant ── */
  if (variant === "modal") {
    return (
      <>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="ep-card p-8 max-w-md w-full text-center space-y-5 border-accent/20"
          >
            <div className="w-14 h-14 mx-auto rounded-full bg-accent/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <h3 className="font-display text-xl font-bold text-text-primary">
              You've used all {picksLimit} free picks today
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Upgrade to Pro for unlimited AI picks, real-time copy trading,
              TP/SL automation, and performance analytics.
            </p>
            <div className="flex flex-col gap-3">
              {/* Stripe — Card / Apple Pay / Google Pay */}
              <button
                onClick={handleStripeUpgrade}
                disabled={stripeLoading}
                className="w-full py-3 rounded-xl bg-accent text-ep-bg font-bold text-sm hover:bg-accent/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CardIcon className="w-4 h-4" />
                {stripeLoading ? "Loading..." : "Pay with Card — $9/mo"}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-ep-border" />
                <span className="text-xs text-text-muted">or</span>
                <div className="flex-1 h-px bg-ep-border" />
              </div>

              {/* USDC */}
              <button
                onClick={handleUsdcUpgrade}
                disabled={usdcLoading}
                className="w-full py-3 rounded-xl bg-[#2775CA]/10 border border-[#2775CA]/20 text-[#2775CA] font-bold text-sm hover:bg-[#2775CA]/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <USDCIcon className="w-4 h-4" />
                {usdcLoading ? "Loading..." : "Pay with USDC — $9/mo"}
              </button>

              <p className="text-xs text-text-muted">
                7-day trial with Stripe. USDC activates instantly for 30 days.
              </p>
            </div>
          </motion.div>
        </div>

        {/* USDC payment modal */}
        <AnimatePresence>
          {usdcPayment && (
            <USDCPaymentModal
              paymentId={usdcPayment.paymentId}
              amount={usdcPayment.amount}
              receivingWallet={usdcPayment.receivingWallet}
              onClose={() => setUsdcPayment(null)}
              onVerified={handleUsdcVerified}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  /* ── Inline variant — shown below picks ── */
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="ep-card p-5 border border-accent/20 bg-gradient-to-r from-accent/[0.03] to-transparent"
      >
        <div className="flex flex-col gap-4">
          <div className="space-y-1">
            <h3 className="font-display font-semibold text-text-primary flex items-center gap-2">
              <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
              {atLimit
                ? `Daily pick limit reached (${picksUsed}/${picksLimit})`
                : `${picksUsed}/${picksLimit} free picks used today`}
            </h3>
            <p className="text-xs text-text-muted">
              Upgrade to Pro for unlimited picks, copy trading, and TP/SL automation.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleStripeUpgrade}
              disabled={stripeLoading}
              className="shrink-0 px-5 py-2.5 rounded-xl bg-accent text-ep-bg font-bold text-sm hover:bg-accent/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CardIcon className="w-4 h-4" />
              {stripeLoading ? "Loading..." : "Pay with Card"}
            </button>
            <button
              onClick={handleUsdcUpgrade}
              disabled={usdcLoading}
              className="shrink-0 px-5 py-2.5 rounded-xl bg-[#2775CA]/10 border border-[#2775CA]/20 text-[#2775CA] font-bold text-sm hover:bg-[#2775CA]/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <USDCIcon className="w-4 h-4" />
              {usdcLoading ? "Loading..." : "Pay with USDC"}
            </button>
          </div>
        </div>
      </motion.div>

      {/* USDC payment modal */}
      <AnimatePresence>
        {usdcPayment && (
          <USDCPaymentModal
            paymentId={usdcPayment.paymentId}
            amount={usdcPayment.amount}
            receivingWallet={usdcPayment.receivingWallet}
            onClose={() => setUsdcPayment(null)}
            onVerified={handleUsdcVerified}
          />
        )}
      </AnimatePresence>
    </>
  );
}
