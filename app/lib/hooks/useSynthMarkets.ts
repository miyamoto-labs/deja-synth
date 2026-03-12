'use client';

import { useState, useEffect, useCallback } from 'react';

/* ── Types ──────────────────────────────────────── */
export interface SynthMarketData {
  asset: 'BTC' | 'ETH' | 'SOL';
  timeframe: 'hourly' | '15min';
  slug: string;
  current_price: number;
  start_price: number;
  current_time: string;
  event_end_time: string;
  event_start_time: string;
  event_creation_time?: string;
  current_outcome: 'Up' | 'Down';
  polymarket_outcome: 'Up' | 'Down';
  polymarket_probability_up: number;
  synth_outcome: 'Up' | 'Down';
  synth_probability_up: number;
  best_bid_price: number;
  best_ask_price: number;
  best_bid_size?: number;
  best_ask_size?: number;
  polymarket_last_trade_price?: number;
  polymarket_last_trade_outcome?: string;
  polymarket_last_trade_time?: string;
  error?: string;
}

export type SynthMarketsMap = Record<string, SynthMarketData>;

/* ── Hook ──────────────────────────────────────── */
/**
 * Polls /api/synth/markets every 60 seconds for all 6 Synth-powered
 * Polymarket predictions (BTC/ETH/SOL × hourly/15min).
 *
 * Reduced from 15s → 60s to conserve Synth API credits ($199/mo plan).
 */
export function useSynthMarkets(enabled: boolean) {
  const [markets, setMarkets] = useState<SynthMarketsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarkets = useCallback(async () => {
    try {
      const res = await fetch('/api/synth/markets');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setMarkets(data.markets || {});
      setError(null);
    } catch (err: any) {
      console.error('[useSynthMarkets] Fetch error:', err.message);
      setError(err.message || 'Failed to fetch Synth markets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    fetchMarkets();
    const interval = setInterval(fetchMarkets, 60_000);
    return () => clearInterval(interval);
  }, [enabled, fetchMarkets]);

  return { markets, loading, error, refetch: fetchMarkets };
}
