"use client";

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
  status: string;
  created_at: string;
  ep_markets_raw?: {
    question: string;
    category: string;
  };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PicksTable({ picks }: { picks: Pick[] }) {
  if (picks.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-brand-card p-8 text-center text-gray-500">
        No picks yet. The engine is scanning markets...
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/5">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/5 bg-brand-card text-xs uppercase tracking-wider text-gray-500">
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Market</th>
            <th className="px-4 py-3">Dir</th>
            <th className="px-4 py-3 text-right">Entry</th>
            <th className="px-4 py-3 text-right">Target</th>
            <th className="px-4 py-3 text-right">Stop</th>
            <th className="px-4 py-3 text-right">R/R</th>
            <th className="px-4 py-3 text-right">Score</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {picks.map((p) => (
            <tr key={p.id} className="bg-brand-dark transition hover:bg-brand-card/50">
              <td className="whitespace-nowrap px-4 py-3 text-gray-400">
                {formatDate(p.created_at)}
              </td>
              <td className="max-w-xs truncate px-4 py-3 font-medium">
                {p.ep_markets_raw?.question || p.market_id}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-bold ${
                    p.direction === "YES"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {p.direction}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-gray-300">{p.entry_price.toFixed(0)}c</td>
              <td className="px-4 py-3 text-right text-emerald-400">{p.target_price.toFixed(0)}c</td>
              <td className="px-4 py-3 text-right text-red-400">{p.stop_loss.toFixed(0)}c</td>
              <td className="px-4 py-3 text-right font-mono text-brand-green">
                {p.risk_reward.toFixed(1)}
              </td>
              <td className="px-4 py-3 text-right">
                <span
                  className={`font-semibold ${
                    p.conviction_score >= 85
                      ? "text-emerald-400"
                      : p.conviction_score >= 75
                      ? "text-yellow-400"
                      : "text-gray-400"
                  }`}
                >
                  {p.conviction_score}
                </span>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    p.status === "active"
                      ? "bg-blue-500/20 text-blue-400"
                      : p.status === "won"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : p.status === "lost"
                      ? "bg-red-500/20 text-red-400"
                      : "bg-gray-500/20 text-gray-400"
                  }`}
                >
                  {p.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
