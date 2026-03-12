"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";

interface MarketOutcome {
  yes_token: string;
  [key: string]: any;
}

interface MarketLike {
  yes_token?: string;
  is_multi?: boolean;
  outcomes?: MarketOutcome[];
  [key: string]: any;
}

const POLL_INTERVAL = 10_000; // 10 seconds

/**
 * Polls live CLOB midpoint prices for a list of markets.
 *
 * Extracts all YES token IDs from the markets (binary + multi-choice outcomes),
 * fetches midpoints from /api/clob/prices every 10s, and returns a map of
 * tokenId → price.
 *
 * The caller can merge these into the market objects to overlay live prices.
 */
export function useMarketPrices(markets: MarketLike[]): Record<string, number> {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const abortRef = useRef<AbortController | null>(null);

  // Extract all unique YES token IDs from current markets
  const tokenIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of markets) {
      if (m.yes_token) ids.add(m.yes_token);
      if (m.is_multi && m.outcomes) {
        for (const o of m.outcomes) {
          if (o.yes_token) ids.add(o.yes_token);
        }
      }
    }
    return [...ids];
  }, [markets]);

  const fetchPrices = useCallback(async () => {
    if (tokenIds.length === 0) return;

    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/clob/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenIds }),
        signal: controller.signal,
      });

      if (!res.ok) return;

      const data = await res.json();
      if (data.prices && Object.keys(data.prices).length > 0) {
        setPrices((prev) => ({ ...prev, ...data.prices }));
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      console.error("useMarketPrices fetch error:", err);
    }
  }, [tokenIds]);

  // Fetch immediately when token list changes
  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // Poll every 10s
  useEffect(() => {
    if (tokenIds.length === 0) return;
    const interval = setInterval(fetchPrices, POLL_INTERVAL);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [fetchPrices, tokenIds]);

  return prices;
}
