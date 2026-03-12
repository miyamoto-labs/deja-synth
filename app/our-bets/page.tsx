"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface SystemTrade {
  id: string;
  pick_id: string;
  market_id: string;
  direction: string;
  amount: number;
  price: number;
  shares: number;
  order_id: string | null;
  status: string;
  pnl: number;
  created_at: string;
  closed_at: string | null;
  market: {
    question: string;
    category: string;
    yes_price: number;
    no_price: number;
  } | null;
  currentPrice: number | null;
}

interface PortfolioStats {
  totalTrades: number;
  activeTrades: number;
  closedTrades: number;
  totalInvested: number;
  totalPnl: number;
  winRate: number;
}

export default function OurBetsPage() {
  const [trades, setTrades] = useState<SystemTrade[]>([]);
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPortfolio() {
      try {
        const res = await fetch("/api/public-portfolio");
        if (res.ok) {
          const data = await res.json();
          setTrades(data.trades || []);
          setStats(data.stats || null);
        }
      } catch {
        // Network error
      } finally {
        setLoading(false);
      }
    }

    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 60_000);
    return () => clearInterval(interval);
  }, []);

  const activeTrades = trades.filter((t) => t.status === "active");
  const closedTrades = trades.filter((t) => t.status !== "active");

  return (
    <div className="min-h-screen bg-ep-bg">
      {/* Header bar */}
      <header className="border-b border-ep-border/50 glass">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="text-lg font-display font-bold">
              <span className="text-deja-cream">Déjà</span><span className="text-deja-amber">.</span>
            </span>
          </Link>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-accent text-ep-bg rounded-lg text-sm font-semibold hover:bg-accent/90 transition"
          >
            Go to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-xs font-semibold text-accent">
            <span className="live-dot" />
            Public Portfolio
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold">
            We Bet Our <span className="text-gradient">Own Picks</span>
          </h1>
          <p className="text-text-muted max-w-lg mx-auto">
            Déjà auto-trades its own highest-conviction AI picks.
            Full transparency — every position, every P&L.
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatBox label="Total Invested" value={`$${stats.totalInvested}`} />
            <StatBox
              label="Total P&L"
              value={`${stats.totalPnl >= 0 ? "+" : ""}$${stats.totalPnl}`}
              color={stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}
            />
            <StatBox label="Win Rate" value={`${stats.winRate}%`} />
            <StatBox label="Positions" value={`${stats.activeTrades} active`} />
          </div>
        )}

        {loading ? (
          <div className="ep-card p-12 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-accent/30 border-t-accent rounded-full mx-auto" />
            <p className="text-sm text-text-muted mt-3">Loading portfolio...</p>
          </div>
        ) : trades.length === 0 ? (
          <div className="ep-card p-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-accent/5 border border-accent/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-accent/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
            </div>
            <h3 className="font-display font-semibold text-text-primary text-lg">Portfolio Coming Soon</h3>
            <p className="text-sm text-text-muted max-w-md mx-auto">
              Déjà will automatically trade its highest-conviction picks. Check back soon to see our live positions.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Active positions */}
            {activeTrades.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-display font-bold flex items-center gap-2">
                  <span className="live-dot" />
                  Active Positions ({activeTrades.length})
                </h2>
                <div className="space-y-3">
                  {activeTrades.map((trade) => (
                    <TradeRow key={trade.id} trade={trade} />
                  ))}
                </div>
              </div>
            )}

            {/* Closed positions */}
            {closedTrades.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-display font-bold text-text-secondary">
                  Closed Positions ({closedTrades.length})
                </h2>
                <div className="space-y-3">
                  {closedTrades.map((trade) => (
                    <TradeRow key={trade.id} trade={trade} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="text-center py-8 space-y-4">
          <p className="text-sm text-text-muted">
            Want AI picks like these? Try Déjà.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="px-6 py-3 bg-accent text-ep-bg rounded-xl font-semibold hover:bg-accent/90 transition"
            >
              View AI Picks
            </Link>
            <Link
              href="/dashboard/bot"
              className="px-6 py-3 border border-accent/30 text-accent rounded-xl font-semibold hover:bg-accent/5 transition"
            >
              Play the Arcade
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="ep-card p-4 text-center">
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className={`text-xl font-display font-bold ${color || "text-text-primary"}`}>{value}</p>
    </div>
  );
}

function TradeRow({ trade }: { trade: SystemTrade }) {
  const unrealizedPnl = trade.status === "active" && trade.currentPrice
    ? (trade.currentPrice - trade.price) * trade.shares
    : null;
  const pnl = trade.status !== "active" ? trade.pnl : unrealizedPnl;
  const pnlStr = pnl !== null ? `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}` : "—";

  return (
    <div className="ep-card p-4 flex items-center gap-4">
      {/* Direction badge */}
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${
        trade.direction === "YES"
          ? "bg-emerald-500/10 text-emerald-400"
          : "bg-red-500/10 text-red-400"
      }`}>
        {trade.direction}
      </div>

      {/* Market info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">
          {trade.market?.question || trade.market_id.slice(0, 30) + "..."}
        </p>
        <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5">
          <span>{trade.market?.category || "—"}</span>
          <span>{new Date(trade.created_at).toLocaleDateString()}</span>
          <span>Entry: {(trade.price * 100).toFixed(0)}c</span>
        </div>
      </div>

      {/* Amount */}
      <div className="text-right">
        <p className="text-sm font-semibold text-text-primary">${trade.amount}</p>
        <p className={`text-xs font-medium ${
          pnl !== null && pnl >= 0 ? "text-emerald-400" : pnl !== null ? "text-red-400" : "text-text-muted"
        }`}>
          {pnlStr}
        </p>
      </div>

      {/* Status */}
      <div>
        {trade.status === "active" ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent/10 text-accent">
            OPEN
          </span>
        ) : trade.status === "won" ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400">
            WON
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400">
            LOST
          </span>
        )}
      </div>
    </div>
  );
}
