"use client";

import { useState, useEffect } from "react";

interface SynthdataResponse {
  synth_probability_up: number;
  polymarket_probability_up: number;
  synth_outcome: string;
  polymarket_outcome: string;
  current_price: number;
}

interface SynthdataPredictionProps {
  asset: "BTC" | "ETH";
  className?: string;
}

export function SynthdataPrediction({ asset, className = "" }: SynthdataPredictionProps) {
  const [data, setData] = useState<SynthdataResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // PAUSED: Direct client-side Synth API calls disabled to conserve credits.
    // This component also had the API key hardcoded in client code (security risk).
    // Use the server proxy /api/synth/markets instead when re-enabling.
    setLoading(false);
  }, [asset]);

  if (loading || !data) {
    return (
      <div className={`bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg p-3 border border-purple-500/20 ${className}`}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
          <span className="text-xs text-gray-400">Loading Synthdata AI...</span>
        </div>
      </div>
    );
  }

  const edge = (data.synth_probability_up - data.polymarket_probability_up) * 100;
  const absEdge = Math.abs(edge);
  const isStrongSignal = absEdge >= 10;

  return (
    <div className={`bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg p-3 border ${
      isStrongSignal ? "border-purple-400/40 shadow-lg shadow-purple-500/20" : "border-purple-500/20"
    } ${className}`}>
      <div className="flex items-center justify-between">
        {/* Left: Label */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="text-xs font-bold text-purple-300">Synthdata AI</span>
          </div>
          {isStrongSignal && (
            <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] font-bold rounded">
              STRONG
            </span>
          )}
        </div>

        {/* Right: Prediction */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-bold ${
                data.synth_outcome === "Up" ? "text-green-400" : "text-red-400"
              }`}>
                {(data.synth_probability_up * 100).toFixed(1)}% {data.synth_outcome.toUpperCase()}
              </span>
              {absEdge >= 5 && (
                <span className={`text-[10px] ${
                  edge > 0 ? "text-green-400/70" : "text-red-400/70"
                }`}>
                  ({edge > 0 ? "+" : ""}{edge.toFixed(1)}% edge)
                </span>
              )}
            </div>
            <div className="text-[10px] text-gray-500">
              vs Polymarket {(data.polymarket_probability_up * 100).toFixed(1)}%
            </div>
          </div>
          
          {/* Indicator */}
          <div className={`w-2 h-2 rounded-full ${
            data.synth_outcome === "Up" ? "bg-green-400" : "bg-red-400"
          } ${isStrongSignal ? "animate-pulse" : ""}`} />
        </div>
      </div>
    </div>
  );
}
