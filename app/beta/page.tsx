"use client";

import { useState, FormEvent } from "react";

export default function BetaGatePage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/beta/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();

      if (data.success) {
        // Full reload so middleware sees the new cookie
        window.location.href = "/";
      } else {
        setError(data.error || "Invalid code");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ep-bg text-text-primary flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 mesh-gradient opacity-30 pointer-events-none" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-sm w-full relative z-10">
        {/* Logo + heading */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <div className="relative h-10 w-10">
              <svg viewBox="0 0 512 512" className="h-full w-full">
                <rect width="512" height="512" fill="#0F1118" rx="96" />
                <g transform="translate(256,256)">
                  <circle cx="0" cy="0" r="120" fill="none" stroke="#00F0A0" strokeWidth="6" opacity="0.2" />
                  <circle cx="0" cy="0" r="80" fill="none" stroke="#00F0A0" strokeWidth="8" opacity="0.4" />
                  <circle cx="0" cy="0" r="40" fill="#00F0A0" />
                  <path
                    d="M-140,60 L-80,20 L-20,-20 L40,-60 L100,-100 L140,-140"
                    fill="none"
                    stroke="#00F0A0"
                    strokeWidth="10"
                    strokeLinecap="round"
                  />
                  <circle cx="140" cy="-140" r="8" fill="#00F0A0" />
                </g>
              </svg>
            </div>
            <span className="text-xl font-display font-bold tracking-tight">
              Easy<span className="text-gradient">Poly</span>
            </span>
          </div>
          <h1 className="text-2xl font-display font-bold">Beta Access</h1>
          <p className="text-sm text-text-secondary mt-2">
            Enter your invite code to continue
          </p>
        </div>

        {/* Code entry card */}
        <div className="ep-card p-6 rounded-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ENTER CODE"
                maxLength={8}
                autoFocus
                autoComplete="off"
                className="w-full px-4 py-3 bg-ep-surface border border-ep-border rounded-xl
                           text-center text-lg font-mono tracking-[0.3em] text-text-primary
                           placeholder:text-text-muted placeholder:tracking-[0.3em]
                           focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20
                           transition"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-loss/5 border border-loss/20 px-3 py-2">
                <p className="text-xs text-loss text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || code.length === 0}
              className="btn-accent w-full py-3 text-sm font-semibold rounded-xl
                         flex items-center justify-center gap-2
                         disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-ep-bg/30 border-t-ep-bg rounded-full animate-spin" />
              ) : (
                "Enter Beta"
              )}
            </button>
          </form>
        </div>

        <p className="text-[10px] text-text-muted text-center mt-6">
          Invited beta testers only. Contact us for access.
        </p>
      </div>
    </div>
  );
}
