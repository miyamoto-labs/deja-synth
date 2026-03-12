import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/* ── Constants ─────────────────────────────────── */
const SYNTH_BASE = 'https://api.synthdata.co';
const ASSETS = ['BTC', 'ETH', 'SOL'] as const;
const TIMEFRAMES = ['hourly', '15min'] as const;
const CACHE_TTL = 300_000; // 5 minutes per market (was 30s — saves ~10x credits)
const FETCH_TIMEOUT = 8_000; // 8s per request
const STAGGER_MS = 200; // 200ms gap between requests to avoid 429

/* ── Per-market cache ─────────────────────────── */
const marketCache = new Map<string, { data: any; timestamp: number }>();

/** Fetch with an AbortController timeout */
async function fetchWithTimeout(url: string, opts: RequestInit, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Small sleep helper for staggering */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET /api/synth/markets
 * Server-side proxy for Synth API — fetches all 6 crypto markets
 * (BTC/ETH/SOL × hourly/15min) with per-market caching.
 *
 * Key design choices to avoid Synth 429 rate limits:
 *  1. Per-market caching (5min) — successful results survive cache misses for other markets
 *  2. Errors are NEVER cached — next request retries the failed market
 *  3. Requests staggered 200ms apart instead of all-at-once blast
 *  4. 8s timeout per request (Vercel free tier = 10s function limit)
 */
export async function GET() {
  try {
    // ── PAUSED: Synth API credits conservation ──────────
    // Return empty markets to stop all API credit consumption.
    // Remove this block to re-enable Synth predictions.
    const SYNTH_PAUSED = process.env.SYNTH_PAUSED !== 'false'; // paused by default
    if (SYNTH_PAUSED) {
      return NextResponse.json({
        markets: {},
        fetchedAt: new Date().toISOString(),
        paused: true,
      });
    }
    // ────────────────────────────────────────────────────

    const apiKey = process.env.SYNTH_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'SYNTH_API_KEY not configured' },
        { status: 500 }
      );
    }

    const now = Date.now();

    // Build the list of markets to fetch
    const allKeys: { key: string; asset: string; timeframe: string }[] = [];
    for (const asset of ASSETS) {
      for (const timeframe of TIMEFRAMES) {
        allKeys.push({ key: `${asset}-${timeframe}`, asset, timeframe });
      }
    }

    // Separate into cached-hits vs needs-fetch
    const markets: Record<string, any> = {};
    const toFetch: typeof allKeys = [];

    for (const entry of allKeys) {
      const cached = marketCache.get(entry.key);
      if (cached && now - cached.timestamp < CACHE_TTL) {
        markets[entry.key] = cached.data;
      } else {
        toFetch.push(entry);
      }
    }

    // Fetch missing/stale markets with stagger to avoid 429
    if (toFetch.length > 0) {
      const fetchPromises = toFetch.map(({ key, asset, timeframe }, idx) => {
        return (async () => {
          // Stagger: wait idx * STAGGER_MS before each request
          if (idx > 0) await sleep(idx * STAGGER_MS);

          const endpoint =
            timeframe === 'hourly'
              ? `/insights/polymarket/up-down/hourly?asset=${asset}`
              : `/insights/polymarket/up-down/15min?asset=${asset}`;

          try {
            const res = await fetchWithTimeout(
              `${SYNTH_BASE}${endpoint}`,
              {
                headers: { Authorization: `Apikey ${apiKey}` },
                next: { revalidate: 0 },
              } as any,
              FETCH_TIMEOUT
            );

            if (!res.ok) {
              console.error(`[Synth] ${key}: HTTP ${res.status}`);
              // Don't cache errors — return stale data if available
              const stale = marketCache.get(key);
              return {
                key,
                data: stale
                  ? stale.data
                  : { asset, timeframe, error: `HTTP ${res.status}` },
              };
            }

            const data = await res.json();
            const result = { asset, timeframe, ...data };
            // Cache only successful results
            marketCache.set(key, { data: result, timestamp: now });
            return { key, data: result };
          } catch (err: any) {
            console.error(`[Synth] ${key} error:`, err.message);
            // Don't cache errors — return stale data if available
            const stale = marketCache.get(key);
            return {
              key,
              data: stale
                ? stale.data
                : { asset, timeframe, error: err.message },
            };
          }
        })();
      });

      const results = await Promise.all(fetchPromises);
      for (const { key, data } of results) {
        markets[key] = data;
      }
    }

    return NextResponse.json({
      markets,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Synth] Markets error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch Synth markets' },
      { status: 500 }
    );
  }
}
