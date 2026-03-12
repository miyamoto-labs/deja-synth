"use client";

import { useState, useEffect } from "react";

interface Strategy {
  name: string;
  edge_threshold: number;
  confidence_threshold: number;
  position_size: number;
  timeframe: string;
  asset: string;
}

interface StrategyBuilderProps {
  onBacktest: (params: {
    strategy_name?: string;
    custom_params?: any;
    days_back: number;
    asset: string;
  }) => void;
  isLoading: boolean;
}

const STRATEGY_DESCRIPTIONS: Record<string, string> = {
  "Gopfan2 Strategy": "Based on the $2M+ Polymarket trader. High edge threshold (15%), waits for clear opportunities. Conservative but proven.",
  "Scalper": "Fast-paced trading with lower thresholds. Takes more trades, smaller positions. Good for active markets.",
  "Sniper": "Ultra-selective strategy. Only trades when edge is massive (20%+). Fewer trades, bigger wins.",
  "Diversified": "Balanced approach across multiple assets. Medium edge, good position sizing.",
  "Conservative": "Safety-first strategy. Highest confidence requirement (90%), minimal risk.",
  "Aggressive": "Maximum trades, higher risk. Low edge threshold (8%), large positions. High variance."
};

export function StrategyBuilder({ onBacktest, isLoading }: StrategyBuilderProps) {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<string>("Gopfan2 Strategy");
  const [customMode, setCustomMode] = useState(false);
  
  // Custom parameters
  const [edgeThreshold, setEdgeThreshold] = useState(15);
  const [confidenceThreshold, setConfidenceThreshold] = useState(75);
  const [positionSize, setPositionSize] = useState(100);
  const [timeframe, setTimeframe] = useState("1h");
  const [asset, setAsset] = useState("BTC");
  const [daysBack, setDaysBack] = useState(30);

  // Fetch available strategies
  useEffect(() => {
    fetch("/api/strategies")
      .then((res) => res.json())
      .then((data) => {
        if (data.strategies) {
          setStrategies(data.strategies);
        }
      })
      .catch((err) => console.error("Failed to fetch strategies:", err));
  }, []);

  const handleRunBacktest = () => {
    if (customMode) {
      onBacktest({
        custom_params: {
          name: "Custom Strategy",
          edge_threshold: edgeThreshold / 100,
          confidence_threshold: confidenceThreshold / 100,
          position_size: positionSize,
          timeframe,
          asset,
        },
        days_back: daysBack,
        asset,
      });
    } else {
      onBacktest({
        strategy_name: selectedStrategy,
        days_back: daysBack,
        asset,
      });
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h2 className="text-2xl font-bold text-foreground mb-6">Build Your Strategy</h2>

      {/* Mode Toggle - SUPER VISIBLE */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => setCustomMode(false)}
          className={`group relative py-6 px-8 rounded-2xl font-bold text-lg transition-all ${
            !customMode
              ? "bg-gradient-to-br from-ep-green via-green-400 to-emerald-400 text-black shadow-2xl shadow-ep-green/40 scale-105"
              : "bg-gradient-to-br from-gray-800 to-gray-900 text-gray-400 hover:text-white border-2 border-gray-700 hover:border-gray-600 hover:scale-[1.02]"
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-4xl">{!customMode ? "✓" : "📊"}</span>
            <span>Pre-Built Strategies</span>
            <span className="text-xs opacity-75 font-normal">
              {!customMode ? "SELECTED" : "Proven strategies from top traders"}
            </span>
          </div>
          {!customMode && (
            <div className="absolute -top-2 -right-2 bg-black text-ep-green text-xs font-bold px-3 py-1 rounded-full border-2 border-ep-green">
              ACTIVE
            </div>
          )}
        </button>
        
        <button
          onClick={() => setCustomMode(true)}
          className={`group relative py-6 px-8 rounded-2xl font-bold text-lg transition-all ${
            customMode
              ? "bg-gradient-to-br from-ep-green via-green-400 to-emerald-400 text-black shadow-2xl shadow-ep-green/40 scale-105"
              : "bg-gradient-to-br from-gray-800 to-gray-900 text-gray-400 hover:text-white border-2 border-gray-700 hover:border-gray-600 hover:scale-[1.02]"
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-4xl">{customMode ? "✓" : "🎛️"}</span>
            <span>Custom Parameters</span>
            <span className="text-xs opacity-75 font-normal">
              {customMode ? "SELECTED" : "Build your own strategy"}
            </span>
          </div>
          {customMode && (
            <div className="absolute -top-2 -right-2 bg-black text-ep-green text-xs font-bold px-3 py-1 rounded-full border-2 border-ep-green">
              ACTIVE
            </div>
          )}
        </button>
      </div>

      {/* Pre-Built Strategy Selector */}
      {!customMode && (
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">
              Select Strategy
            </label>
            <select
              value={selectedStrategy}
              onChange={(e) => setSelectedStrategy(e.target.value)}
              className="w-full bg-card-muted border border-border rounded-lg px-4 py-2 text-foreground"
            >
              {strategies.map((strategy) => (
                <option key={strategy.name} value={strategy.name}>
                  {strategy.name}
                </option>
              ))}
            </select>
          </div>

          {/* Show selected strategy details */}
          {strategies.find((s) => s.name === selectedStrategy) && (
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-lg p-4 space-y-3 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">ℹ️</span>
                <h3 className="font-bold text-foreground text-base">Strategy Details</h3>
              </div>
              
              {/* Strategy Description */}
              <p className="text-gray-300 italic border-l-2 border-ep-green pl-3 py-1">
                {STRATEGY_DESCRIPTIONS[selectedStrategy] || "Custom trading strategy"}
              </p>
              {(() => {
                const strategy = strategies.find((s) => s.name === selectedStrategy)!;
                return (
                  <>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Edge Threshold:</span>
                      <span className="font-medium text-foreground">
                        {(strategy.edge_threshold * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Confidence:</span>
                      <span className="font-medium text-foreground">
                        {(strategy.confidence_threshold * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Position Size:</span>
                      <span className="font-medium text-foreground">
                        ${strategy.position_size}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Timeframe:</span>
                      <span className="font-medium text-foreground">{strategy.timeframe}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Custom Parameters */}
      {customMode && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Edge Threshold */}
          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">
              Edge Threshold: {edgeThreshold}%
            </label>
            <input
              type="range"
              min="5"
              max="30"
              step="1"
              value={edgeThreshold}
              onChange={(e) => setEdgeThreshold(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-text-muted mt-1">
              Minimum edge required to take a trade
            </p>
          </div>

          {/* Confidence Threshold */}
          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">
              Confidence: {confidenceThreshold}%
            </label>
            <input
              type="range"
              min="50"
              max="95"
              step="5"
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-text-muted mt-1">Minimum prediction confidence</p>
          </div>

          {/* Position Size */}
          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">
              Position Size: ${positionSize}
            </label>
            <input
              type="range"
              min="25"
              max="500"
              step="25"
              value={positionSize}
              onChange={(e) => setPositionSize(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-text-muted mt-1">Amount per trade</p>
          </div>

          {/* Timeframe */}
          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">Timeframe</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full bg-card-muted border border-border rounded-lg px-4 py-2 text-foreground"
            >
              <option value="1h">1 Hour</option>
              <option value="24h">24 Hours</option>
            </select>
          </div>
        </div>
      )}

      {/* Common Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Asset Selector */}
        <div>
          <label className="block text-sm font-medium text-text-muted mb-2">Asset</label>
          <select
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            className="w-full bg-card-muted border border-border rounded-lg px-4 py-2 text-foreground"
          >
            <option value="BTC">Bitcoin (BTC)</option>
            <option value="ETH">Ethereum (ETH)</option>
            <option value="SOL">Solana (SOL)</option>
            <option value="NVDA">NVIDIA (NVDA)</option>
            <option value="TSLA">Tesla (TSLA)</option>
          </select>
        </div>

        {/* Days Back */}
        <div>
          <label className="block text-sm font-medium text-text-muted mb-2">
            Backtest Period: {daysBack} days
          </label>
          <input
            type="range"
            min="7"
            max="90"
            step="1"
            value={daysBack}
            onChange={(e) => setDaysBack(Number(e.target.value))}
            className="w-full"
          />
          <p className="text-xs text-text-muted mt-1">Historical data to analyze</p>
        </div>
      </div>

      {/* Run Backtest Button */}
      <div className="flex gap-4">
        <button
          onClick={handleRunBacktest}
          disabled={isLoading}
          className={`flex-1 py-4 rounded-xl font-bold text-xl transition-all shadow-lg ${
            isLoading
              ? "bg-gray-700 text-gray-400 cursor-not-allowed"
              : "bg-gradient-to-r from-ep-green to-green-400 text-black hover:shadow-ep-green/50 hover:scale-[1.02] shadow-ep-green/30"
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Running Backtest...
            </span>
          ) : (
            "🚀 Run Backtest"
          )}
        </button>
        
        {/* Quick Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setDaysBack(7);
              handleRunBacktest();
            }}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium border border-gray-700 transition-all"
            title="Quick 7-day backtest"
          >
            7d
          </button>
          <button
            onClick={() => {
              setDaysBack(30);
              handleRunBacktest();
            }}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium border border-gray-700 transition-all"
            title="Quick 30-day backtest"
          >
            30d
          </button>
          <button
            onClick={() => {
              setDaysBack(90);
              handleRunBacktest();
            }}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium border border-gray-700 transition-all"
            title="Quick 90-day backtest"
          >
            90d
          </button>
        </div>
      </div>
    </div>
  );
}
