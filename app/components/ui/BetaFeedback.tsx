"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useUserStore } from "@/app/lib/stores/user-store";

const TELEGRAM_DM = "https://t.me/gmdveth";

export function BetaFeedback() {
  const pathname = usePathname();
  const { walletAddress } = useUserStore();

  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [showNudge, setShowNudge] = useState(false);

  // Hide on PolyTinder — overlaps with swipe queue remove buttons
  const isHidden = pathname === "/dashboard/polytinder";

  // Show nudge bubble after 30s on first visit (once per session)
  useEffect(() => {
    const nudged = sessionStorage.getItem("ep_feedback_nudged");
    if (nudged) return;

    const timer = setTimeout(() => {
      setShowNudge(true);
      sessionStorage.setItem("ep_feedback_nudged", "1");
    }, 30000);

    return () => clearTimeout(timer);
  }, []);

  // Auto-dismiss nudge after 8s
  useEffect(() => {
    if (!showNudge) return;
    const timer = setTimeout(() => setShowNudge(false), 8000);
    return () => clearTimeout(timer);
  }, [showNudge]);

  if (isHidden) return null;

  async function handleSubmit() {
    if (!message.trim()) return;
    setSending(true);

    try {
      await fetch("/api/beta/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          page: pathname,
          walletAddress,
        }),
      });
      setSent(true);
      setMessage("");
      setTimeout(() => {
        setSent(false);
        setOpen(false);
      }, 2000);
    } catch {
      // Silently fail — non-critical
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Floating feedback button */}
      <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 flex flex-col items-end gap-2">
        {/* Nudge bubble */}
        <AnimatePresence>
          {showNudge && !open && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              className="ep-card px-4 py-3 rounded-2xl max-w-[220px] shadow-lg border border-accent/20"
            >
              <p className="text-xs text-text-primary leading-relaxed">
                Hey! What do you think so far? We&apos;d love your feedback
              </p>
              <button
                onClick={() => {
                  setShowNudge(false);
                  setOpen(true);
                }}
                className="text-[11px] text-accent font-semibold mt-1.5 hover:text-accent/80 transition"
              >
                Share thoughts →
              </button>
              {/* Tail */}
              <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-ep-card border-r border-b border-accent/20 rotate-45" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* FAB button */}
        <motion.button
          onClick={() => {
            setShowNudge(false);
            setOpen(!open);
          }}
          className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${
            open
              ? "bg-ep-surface border border-ep-border text-text-muted"
              : "bg-accent text-ep-bg hover:bg-accent/90"
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {open ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          )}
        </motion.button>
      </div>

      {/* Feedback modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-36 right-4 md:bottom-20 md:right-6 z-40 w-[calc(100vw-2rem)] max-w-sm"
          >
            <div className="ep-card rounded-2xl shadow-2xl border border-ep-border/50 overflow-hidden">
              {/* Header */}
              <div className="px-5 pt-5 pb-3">
                <h3 className="text-sm font-bold text-text-primary">
                  Share Your Feedback
                </h3>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Bugs, ideas, complaints — we want it all
                </p>
              </div>

              {sent ? (
                <div className="px-5 pb-5 text-center py-6">
                  <div className="text-3xl mb-2">🙏</div>
                  <p className="text-sm font-medium text-text-primary">Thanks!</p>
                  <p className="text-xs text-text-muted mt-1">Your feedback means a lot</p>
                </div>
              ) : (
                <div className="px-5 pb-5 space-y-3">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="What's on your mind?"
                    rows={3}
                    autoFocus
                    className="w-full px-3 py-2.5 bg-ep-surface border border-ep-border rounded-xl
                               text-sm text-text-primary placeholder:text-text-muted
                               focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20
                               transition resize-none"
                  />

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSubmit}
                      disabled={sending || !message.trim()}
                      className="btn-accent flex-1 py-2.5 text-xs font-semibold rounded-xl
                                 flex items-center justify-center gap-1.5
                                 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {sending ? (
                        <div className="h-3.5 w-3.5 border-2 border-ep-bg/30 border-t-ep-bg rounded-full animate-spin" />
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                          </svg>
                          Send
                        </>
                      )}
                    </button>

                    <a
                      href={TELEGRAM_DM}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold
                                 border border-ep-border text-text-secondary hover:text-accent hover:border-accent/30
                                 transition"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                      </svg>
                      DM
                    </a>
                  </div>

                  <p className="text-[10px] text-text-muted text-center">
                    Or message me directly on{" "}
                    <a href={TELEGRAM_DM} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      Telegram @gmdveth
                    </a>
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
