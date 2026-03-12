"use client";

import { useState, useEffect, useCallback } from "react";

interface Execution {
  id: string;
  standing_order_id: string;
  pick_id: string;
  user_wallet: string;
  amount: number;
  price: number;
  direction: string;
  token_id: string;
  order_id: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
  pick: {
    conviction_score: number;
    market: {
      question: string;
      category: string;
    } | null;
  } | null;
}

interface StandingOrderHistoryProps {
  wallet: string;
  orderId?: string; // optional: filter to specific order
}

export default function StandingOrderHistory({ wallet, orderId }: StandingOrderHistoryProps) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      let url = `/api/standing-orders/history?wallet=${wallet}&limit=50`;
      if (orderId) url += `&orderId=${orderId}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setExecutions(data.executions || []);
      }
    } catch {
      // Network error
    } finally {
      setLoading(false);
    }
  }, [wallet, orderId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (loading) {
    return (
      <div className="ep-card p-8 text-center">
        <div className="animate-spin h-8 w-8 border-2 border-accent/30 border-t-accent rounded-full mx-auto" />
        <p className="text-sm text-text-muted mt-3">Loading history...</p>
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <div className="ep-card p-8 text-center space-y-3">
        <div className="w-12 h-12 mx-auto rounded-full bg-ep-border/20 flex items-center justify-center">
          <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm text-text-muted">No executions yet. Trades will appear here when your standing orders match new AI picks.</p>
      </div>
    );
  }

  return (
    <div className="ep-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-ep-border/30">
        <h3 className="text-sm font-semibold text-text-primary">Execution History</h3>
        <p className="text-xs text-text-muted">{executions.length} executions</p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-text-muted border-b border-ep-border/20">
              <th className="text-left font-medium px-5 py-2.5">Time</th>
              <th className="text-left font-medium px-3 py-2.5">Market</th>
              <th className="text-center font-medium px-3 py-2.5">Dir</th>
              <th className="text-right font-medium px-3 py-2.5">Amount</th>
              <th className="text-right font-medium px-3 py-2.5">Price</th>
              <th className="text-center font-medium px-5 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {executions.map((exec) => (
              <tr key={exec.id} className="border-b border-ep-border/10 hover:bg-ep-border/5 transition">
                <td className="px-5 py-3">
                  <span className="text-xs text-text-muted whitespace-nowrap">
                    {formatTimeAgo(exec.created_at)}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className="text-xs text-text-primary line-clamp-1 max-w-[200px]">
                    {exec.pick?.market?.question || exec.pick_id.slice(0, 12) + "..."}
                  </span>
                  {exec.pick && (
                    <span className="text-[10px] text-text-muted">
                      {exec.pick.conviction_score}% conviction
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                    exec.direction === "YES"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-red-500/10 text-red-400"
                  }`}>
                    {exec.direction}
                  </span>
                </td>
                <td className="px-3 py-3 text-right">
                  <span className="text-xs font-semibold text-text-primary">${exec.amount}</span>
                </td>
                <td className="px-3 py-3 text-right">
                  <span className="text-xs text-text-muted">{(exec.price * 100).toFixed(0)}c</span>
                </td>
                <td className="px-5 py-3 text-center">
                  <StatusBadge status={exec.status} error={exec.error_message} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status, error }: { status: string; error: string | null }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    executed: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Executed" },
    failed: { bg: "bg-red-500/10", text: "text-red-400", label: "Failed" },
    skipped: { bg: "bg-yellow-500/10", text: "text-yellow-500", label: "Skipped" },
    pending: { bg: "bg-blue-500/10", text: "text-blue-400", label: "Pending" },
  };

  const { bg, text, label } = config[status] || config.pending;

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${bg} ${text}`} title={error || undefined}>
      {label}
    </span>
  );
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;

  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(dateStr).toLocaleDateString();
}
