"use client";

import { useState } from "react";

interface Trade {
  timestamp: string;
  asset: string;
  direction: string;
  entry_price: number;
  exit_price: number;
  position_size: number;
  profit: number;
  edge: number;
  confidence: number;
  outcome: number;
}

interface TradesTableProps {
  trades: Trade[];
}

export function TradesTable({ trades }: TradesTableProps) {
  const [showAll, setShowAll] = useState(false);
  const displayTrades = showAll ? trades : trades.slice(0, 10);

  const exportToCSV = () => {
    const headers = [
      "Timestamp",
      "Asset",
      "Direction",
      "Position Size",
      "Profit",
      "Edge",
      "Confidence",
      "Outcome",
    ];

    const rows = trades.map((trade) => [
      trade.timestamp,
      trade.asset,
      trade.direction,
      trade.position_size,
      trade.profit,
      trade.edge,
      trade.confidence,
      trade.outcome === 1 ? "Win" : "Loss",
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backtest-trades-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (trades.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-2xl font-bold text-foreground mb-4">Trade History</h2>
        <p className="text-text-muted text-center py-8">No trades executed</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-foreground">
          Trade History ({trades.length} trades)
        </h2>
        <button
          onClick={exportToCSV}
          className="px-4 py-2 bg-ep-green text-black font-medium rounded-lg hover:bg-ep-green/90 transition-colors"
        >
          📥 Export CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-text-muted font-medium">Date</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Asset</th>
              <th className="text-left py-3 px-4 text-text-muted font-medium">Direction</th>
              <th className="text-right py-3 px-4 text-text-muted font-medium">Size</th>
              <th className="text-right py-3 px-4 text-text-muted font-medium">Edge</th>
              <th className="text-right py-3 px-4 text-text-muted font-medium">Confidence</th>
              <th className="text-right py-3 px-4 text-text-muted font-medium">Profit</th>
              <th className="text-center py-3 px-4 text-text-muted font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {displayTrades.map((trade, index) => (
              <tr
                key={index}
                className={`border-b border-border/50 hover:bg-card-hover transition-colors ${
                  trade.profit > 0 ? "bg-green-500/5" : "bg-red-500/5"
                }`}
              >
                <td className="py-3 px-4 text-foreground">
                  {new Date(trade.timestamp).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="py-3 px-4 text-foreground font-medium">{trade.asset}</td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      trade.direction === "long"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {trade.direction.toUpperCase()}
                  </span>
                </td>
                <td className="py-3 px-4 text-right text-foreground">
                  ${trade.position_size.toFixed(0)}
                </td>
                <td className="py-3 px-4 text-right text-foreground">
                  {(trade.edge * 100).toFixed(1)}%
                </td>
                <td className="py-3 px-4 text-right text-foreground">
                  {(trade.confidence * 100).toFixed(0)}%
                </td>
                <td
                  className={`py-3 px-4 text-right font-medium ${
                    trade.profit > 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {trade.profit > 0 ? "+" : ""}${trade.profit.toFixed(2)}
                </td>
                <td className="py-3 px-4 text-center">
                  {trade.outcome === 1 ? (
                    <span className="text-green-400 text-lg">✓</span>
                  ) : (
                    <span className="text-red-400 text-lg">✗</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {trades.length > 10 && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowAll(!showAll)}
            className="px-4 py-2 bg-card-muted text-foreground rounded-lg hover:bg-card-hover transition-colors"
          >
            {showAll ? "Show Less" : `Show All (${trades.length} trades)`}
          </button>
        </div>
      )}
    </div>
  );
}
