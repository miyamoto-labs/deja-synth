"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useUserStore } from "@/app/lib/stores/user-store";

/* ── Tour Step Definitions ─────────────────────── */
interface TourStep {
  target: string;
  title: string;
  description: string;
  position: "top" | "bottom";
}

const STEPS: TourStep[] = [
  {
    target: "arcade-header",
    title: "Welcome to the Arcade",
    description:
      "This is your click-to-bet casino. Each click places a real $1 trade on Polymarket.",
    position: "bottom",
  },
  {
    target: "jackpot-meter",
    title: "Jackpot Pool",
    description:
      "Every bet adds to the weekly jackpot. The top ROI player wins the whole pool!",
    position: "bottom",
  },
  {
    target: "live-chart",
    title: "Live Price Feed",
    description:
      "Real-time BTC/ETH price from Binance. Watch the chart to time your UP or DOWN clicks.",
    position: "top",
  },
  {
    target: "market-picker",
    title: "Pick Your Market",
    description:
      "BTC 5-min is fast & volatile, 15-min is balanced, ETH 15-min is less crowded.",
    position: "top",
  },
  {
    target: "buy-clicks",
    title: "Buy Your Clicks",
    description:
      "Slide to choose how many $1 bets you want. Start small — you can always buy more later.",
    position: "top",
  },
];

const PAD = 12;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

export function ArcadeTour() {
  const { hasSeenArcadeTour, hasCompletedOnboarding, setArcadeTourSeen } =
    useUserStore();

  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const shouldShow = !hasSeenArcadeTour && hasCompletedOnboarding;

  /* ── Plain handlers (no useCallback) ─────────── */
  const goNext = () => {
    if (step >= STEPS.length - 1) {
      setArcadeTourSeen();
    } else {
      setStep((s) => s + 1);
    }
  };

  const goBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const skip = () => {
    setArcadeTourSeen();
  };

  // Delay to let the page render
  useEffect(() => {
    if (!shouldShow) return;
    timerRef.current = setTimeout(() => setReady(true), 1000);
    return () => clearTimeout(timerRef.current);
  }, [shouldShow]);

  // Measure the target element
  const measure = useCallback(() => {
    if (!ready) return;
    const s = STEPS[step];
    if (!s) return;

    const el = document.querySelector(`[data-tour="${s.target}"]`);
    if (!el) {
      if (step < STEPS.length - 1) setStep((p) => p + 1);
      else setArcadeTourSeen();
      return;
    }

    el.scrollIntoView({ behavior: "smooth", block: "center" });

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top - PAD,
        left: r.left - PAD,
        width: r.width + PAD * 2,
        height: r.height + PAD * 2,
        bottom: r.bottom + PAD,
        right: r.right + PAD,
      });
    }, 400);
  }, [step, ready, setArcadeTourSeen]);

  useEffect(() => {
    measure();
  }, [measure]);

  // Re-measure on resize
  useEffect(() => {
    if (!ready) return;
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(measure, 200);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(t);
    };
  }, [ready, measure]);

  if (!shouldShow || !ready || !rect) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Clip-path: full screen with a rectangular hole cut out
  const clipPath = `polygon(
    0% 0%, 0% 100%,
    ${rect.left}px 100%,
    ${rect.left}px ${rect.top}px,
    ${rect.right}px ${rect.top}px,
    ${rect.right}px ${rect.bottom}px,
    ${rect.left}px ${rect.bottom}px,
    ${rect.left}px 100%,
    100% 100%, 100% 0%
  )`;

  // Tooltip position
  const isMobile = vw < 640;
  const gap = 14;
  const tooltipStyle: React.CSSProperties = { position: "fixed", zIndex: 81 };

  if (current.position === "bottom") {
    tooltipStyle.top = rect.bottom + gap;
  } else {
    tooltipStyle.bottom = vh - rect.top + gap;
  }

  if (isMobile) {
    tooltipStyle.left = 16;
    tooltipStyle.right = 16;
  } else {
    tooltipStyle.left = Math.max(16, Math.min(rect.left, vw - 340));
    tooltipStyle.maxWidth = 320;
  }

  // Arrow offset
  const arrowLeft = isMobile
    ? "50%"
    : `${Math.min(Math.max(24, rect.left + rect.width / 2 - (tooltipStyle.left as number)), 280)}px`;

  return (
    <>
      {/* ── Dark overlay with cutout ── */}
      <motion.div
        className="fixed inset-0 z-[80] bg-black/70"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ clipPath }}
        onClick={skip}
      />

      {/* ── Glow ring ── */}
      <motion.div
        className="fixed z-[80] rounded-xl pointer-events-none"
        animate={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          boxShadow: [
            "0 0 12px rgba(0, 240, 160, 0.2), inset 0 0 12px rgba(0, 240, 160, 0.06)",
            "0 0 28px rgba(0, 240, 160, 0.35), inset 0 0 28px rgba(0, 240, 160, 0.12)",
            "0 0 12px rgba(0, 240, 160, 0.2), inset 0 0 12px rgba(0, 240, 160, 0.06)",
          ],
        }}
        transition={{
          top: { type: "spring", stiffness: 300, damping: 30 },
          left: { type: "spring", stiffness: 300, damping: 30 },
          width: { type: "spring", stiffness: 300, damping: 30 },
          height: { type: "spring", stiffness: 300, damping: 30 },
          boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" },
        }}
        style={{ border: "2px solid rgba(0, 240, 160, 0.4)" }}
      />

      {/* ── Tooltip (stays mounted, content updates) ── */}
      <div
        className="bg-ep-card border border-accent/20 rounded-2xl p-5 shadow-card"
        style={tooltipStyle}
      >
        {/* Arrow */}
        <div
          className="absolute w-0 h-0"
          style={{
            left: arrowLeft,
            transform: isMobile ? "translateX(-50%)" : undefined,
            ...(current.position === "bottom"
              ? {
                  top: -8,
                  borderLeft: "8px solid transparent",
                  borderRight: "8px solid transparent",
                  borderBottom: "8px solid var(--ep-card, #151823)",
                }
              : {
                  bottom: -8,
                  borderLeft: "8px solid transparent",
                  borderRight: "8px solid transparent",
                  borderTop: "8px solid var(--ep-card, #151823)",
                }),
          }}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">
            Step {step + 1} of {STEPS.length}
          </span>
          <button
            onClick={skip}
            className="text-[10px] text-text-muted hover:text-text-secondary transition-colors"
          >
            Skip Tour
          </button>
        </div>

        {/* Content */}
        <h3 className="text-sm font-semibold text-text-primary mb-1">
          {current.title}
        </h3>
        <p className="text-xs text-text-secondary leading-relaxed">
          {current.description}
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === step ? 16 : 6,
                  backgroundColor:
                    i === step
                      ? "#00F0A0"
                      : i < step
                        ? "rgba(0, 240, 160, 0.4)"
                        : "rgba(255, 255, 255, 0.15)",
                }}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={goBack}
                className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary rounded-lg border border-ep-border hover:border-text-muted transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={goNext}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-accent text-ep-bg hover:bg-accent/90 active:scale-95 transition-all"
            >
              {isLast ? "Got it!" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
