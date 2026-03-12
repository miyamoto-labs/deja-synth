"use client";

import { useState } from "react";
import { StrategyBuilder } from "./components/StrategyBuilder";
import { ResultsChart } from "./components/ResultsChart";
import { TradesTable } from "./components/TradesTable";
import { MetricsCards } from "./components/MetricsCards";
import { StrategyVerdict } from "./components/StrategyVerdict";

export interface BacktestResult {
  strategy: {
    name: string;
    edge_threshold: number;
    confidence_threshold: number;
    position_size: number;
    timeframe: string;
    asset: string;
  };
  metrics: {
    total_return: number;
    total_return_pct: number;
    win_rate: number;
    sharpe_ratio: number;
    max_drawdown: number;
    max_drawdown_pct: number;
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    avg_win: number;
    avg_loss: number;
    largest_win: number;
    largest_loss: number;
    profit_factor: number;
  };
  trades: Array<{
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
  }>;
  equity_curve: Array<{
    date: string;
    equity: number;
  }>;
}

export default function StrategyLabPage() {
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBacktest = async (params: {
    strategy_name?: string;
    custom_params?: any;
    days_back: number;
    asset: string;
  }) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/backtest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`Backtest failed: ${response.statusText}`);
      }

      const result = await response.json();
      setBacktestResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run backtest");
      console.error("Backtest error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b border-border pb-6">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Strategy Lab 🧪
          </h1>
          <p className="text-text-muted text-lg">
            Backtest trading strategies against historical Synthdata predictions
          </p>
        </div>

        {/* Demo Mode Banner */}
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 text-3xl">ℹ️</div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-blue-400 mb-2">Demo Mode (Mock Data)</h3>
              <p className="text-gray-300 mb-3">
                Currently using <strong>simulated historical data</strong> for demonstration purposes. 
                Results show realistic trading patterns based on Synthdata's documented accuracy.
              </p>
              <div className="bg-black/30 rounded-lg p-4 space-y-2 text-sm">
                <p className="text-gray-400"><strong className="text-blue-400">🔜 When connected to Synthdata API:</strong></p>
                <ul className="list-disc list-inside text-gray-400 space-y-1 ml-2">
                  <li>Real historical predictions from Synthdata miners</li>
                  <li>Actual Polymarket probability comparisons</li>
                  <li>Verified edge calculations (Synth prob - Market prob)</li>
                  <li>True performance metrics from past 30-90 days</li>
                  <li>Export strategies as live trading bots</li>
                </ul>
              </div>
              <div className="mt-4 flex gap-3">
                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium border border-green-500/30">
                  ✓ UI Complete
                </span>
                <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-medium border border-yellow-500/30">
                  ⏳ API Integration In Progress
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Strategy Builder */}
        <StrategyBuilder onBacktest={handleBacktest} isLoading={isLoading} />

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <p className="text-red-400 font-medium">❌ {error}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ep-green"></div>
          </div>
        )}

        {/* Results */}
        {backtestResult && !isLoading && (
          <div className="space-y-6">
            {/* Strategy Info */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {backtestResult.strategy.name}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-text-muted">Asset:</span>
                  <span className="ml-2 font-medium text-foreground">
                    {backtestResult.strategy.asset}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted">Timeframe:</span>
                  <span className="ml-2 font-medium text-foreground">
                    {backtestResult.strategy.timeframe}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted">Edge Threshold:</span>
                  <span className="ml-2 font-medium text-foreground">
                    {(backtestResult.strategy.edge_threshold * 100).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-text-muted">Confidence:</span>
                  <span className="ml-2 font-medium text-foreground">
                    {(backtestResult.strategy.confidence_threshold * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Metrics Cards */}
            <MetricsCards metrics={backtestResult.metrics} />

            {/* Strategy Verdict - Clear Recommendation */}
            <StrategyVerdict 
              metrics={backtestResult.metrics} 
              strategyName={backtestResult.strategy.name} 
            />

            {/* Equity Curve */}
            <ResultsChart equityCurve={backtestResult.equity_curve} />

            {/* Trades Table */}
            <TradesTable trades={backtestResult.trades} />
          </div>
        )}

        {/* Empty State */}
        {!backtestResult && !isLoading && !error && (
          <div className="text-center py-12">
            <p className="text-text-muted text-lg">
              Select a strategy and run a backtest to see results 📊
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
