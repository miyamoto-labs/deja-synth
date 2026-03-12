"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface PricePoint {
  t: number;
  p: number;
}

// ── Module-level shared state (persists across all hook instances) ──

/** Cache: tokenId → price history (survives re-renders, shared across all cards) */
const cache = new Map<string, PricePoint[]>();

/** Tokens waiting to be fetched (batched together) */
const pendingTokens = new Set<string>();

/** Callbacks waiting for fetch results: tokenId → Set<callback> */
const waiters = new Map<string, Set<(data: PricePoint[]) => void>>();

/** Debounce timer for batching */
let batchTimer: ReturnType<typeof setTimeout> | null = null;

/** Currently in-flight fetch (prevent duplicates) */
let fetching = false;

const BATCH_DELAY = 200; // ms to wait before firing batch request
const MAX_BATCH = 50;

/** Fire a batch request for all pending tokens */
async function flushBatch() {
  if (pendingTokens.size === 0 || fetching) return;

  const tokenIds = [...pendingTokens].slice(0, MAX_BATCH);
  pendingTokens.clear();
  fetching = true;

  try {
    const res = await fetch("/api/clob/price-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenIds }),
    });

    if (!res.ok) {
      fetching = false;
      return;
    }

    const data = await res.json();
    const histories: Record<string, PricePoint[]> = data.histories || {};

    // Distribute results to cache and waiting hooks
    for (const tokenId of tokenIds) {
      const history = histories[tokenId] || [];
      cache.set(tokenId, history);

      const callbacks = waiters.get(tokenId);
      if (callbacks) {
        for (const cb of callbacks) cb(history);
        waiters.delete(tokenId);
      }
    }
  } catch (err) {
    console.error("useSparklineData batch error:", err);
  } finally {
    fetching = false;

    // If more tokens arrived while we were fetching, flush again
    if (pendingTokens.size > 0) {
      batchTimer = setTimeout(flushBatch, BATCH_DELAY);
    }
  }
}

/** Schedule a token to be fetched in the next batch */
function requestToken(
  tokenId: string,
  callback: (data: PricePoint[]) => void
) {
  // Already cached?
  const cached = cache.get(tokenId);
  if (cached !== undefined) {
    callback(cached);
    return;
  }

  // Register callback
  if (!waiters.has(tokenId)) {
    waiters.set(tokenId, new Set());
  }
  waiters.get(tokenId)!.add(callback);

  // Add to pending batch
  pendingTokens.add(tokenId);

  // Debounce the batch flush
  if (batchTimer) clearTimeout(batchTimer);
  batchTimer = setTimeout(flushBatch, BATCH_DELAY);
}

/** Cancel a pending callback */
function cancelRequest(tokenId: string, callback: (data: PricePoint[]) => void) {
  const callbacks = waiters.get(tokenId);
  if (callbacks) {
    callbacks.delete(callback);
    if (callbacks.size === 0) waiters.delete(tokenId);
  }
}

// ── Hook ──

interface UseSparklineResult {
  data: PricePoint[] | null;
  loading: boolean;
}

/**
 * Lazy-loads sparkline price history for a single token.
 *
 * - Only fetches when the card is visible (IntersectionObserver via cardRef)
 * - Batches requests across multiple visible cards (200ms debounce window)
 * - Caches results at module level (survives re-renders, shared across cards)
 *
 * @param tokenId - The YES token ID for the market
 * @param cardRef - Ref to the card DOM element for visibility detection
 */
export function useSparklineData(
  tokenId: string | undefined,
  cardRef: React.RefObject<HTMLDivElement | null>
): UseSparklineResult {
  const [data, setData] = useState<PricePoint[] | null>(() => {
    if (!tokenId) return null;
    return cache.get(tokenId) ?? null;
  });
  const [loading, setLoading] = useState(false);
  const hasRequestedRef = useRef(false);

  const handleResult = useCallback((history: PricePoint[]) => {
    setData(history.length > 0 ? history : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!tokenId || !cardRef.current) return;

    // Already have data cached
    const cached = cache.get(tokenId);
    if (cached !== undefined) {
      setData(cached.length > 0 ? cached : null);
      return;
    }

    hasRequestedRef.current = false;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasRequestedRef.current) {
          hasRequestedRef.current = true;
          setLoading(true);
          requestToken(tokenId, handleResult);
        }
      },
      { rootMargin: "200px" } // Pre-fetch slightly before visible
    );

    observer.observe(cardRef.current);

    return () => {
      observer.disconnect();
      cancelRequest(tokenId, handleResult);
    };
  }, [tokenId, cardRef, handleResult]);

  return { data, loading };
}
