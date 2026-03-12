"use client";

import { useState, useEffect } from "react";
import { ArcadeCountdown } from "./ArcadeCountdown";
import { MiniRaceView } from "./MiniRaceView";
import { useBinancePrice } from "@/app/lib/hooks/useBinancePrice";
import {
  getNextWindowTimestamp,
  formatWindowTimeRange,
  getCurrentWindowTimestamp,
} from "@/app/lib/utils/market-windows";

export function LiveMarketPreview() {
  const btcPrice = useBinancePrice("btcusdt");
  const [tick, setTick] = useState(0);

  // Refresh window labels every 10s
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(iv);
  }, []);

  const currentWindowTs = getCurrentWindowTimestamp();
  const nextWindowTs = getNextWindowTimestamp();
  const currentTimeRange = formatWindowTimeRange(currentWindowTs);

  return (
    <div className="ep-card overflow-hidden border border-accent/15 bg-gradient-to-br from-accent/[0.03] to-transparent">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <span className="live-dot" />
            Live Market Preview
          </h3>
          <p className="text-[10px] text-text-muted mt-0.5">
            5-minute markets resolve every 5 minutes on the clock
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">
            Current Window
          </p>
          <p className="text-xs font-mono text-accent font-semibold">
            {currentTimeRange}
          </p>
        </div>
      </div>

      {/* Countdown + Chart */}
      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 px-4 pb-4">
        {/* Countdown */}
        <div className="flex flex-col items-center justify-center py-2 sm:px-4">
          <ArcadeCountdown
            windowEndTimestamp={nextWindowTs}
            intervalMinutes={5}
          />
        </div>

        {/* Mini chart (read-only) */}
        <div className="h-[120px] sm:h-[140px] rounded-lg overflow-hidden border border-ep-border/30 bg-ep-surface/30">
          <div className="relative w-full h-full">
            <MiniRaceView
              pricesRef={btcPrice.pricesRef}
              latestPriceRef={btcPrice.latestPriceRef}
              smoothPriceRef={btcPrice.smoothPriceRef}
              currentPrice={btcPrice.currentPrice}
              connected={btcPrice.connected}
              activeBet={null}
            />
            {/* BTC label overlay */}
            <div className="absolute top-2 left-2 flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-text-muted bg-ep-bg/60 backdrop-blur-sm px-1.5 py-0.5 rounded">
                BTC/USD
              </span>
              {btcPrice.currentPrice > 0 && (
                <span className="text-[10px] font-mono font-bold text-accent bg-ep-bg/60 backdrop-blur-sm px-1.5 py-0.5 rounded">
                  $
                  {btcPrice.currentPrice.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
