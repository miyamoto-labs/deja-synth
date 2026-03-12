import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GAMMA_URL = 'https://gamma-api.polymarket.com';

/**
 * GET /api/bot/active-market?asset=btc&interval=5
 * Resolves the current Polymarket binary up/down market for the given asset + timeframe.
 * Returns token IDs, prices, and end time.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const asset = (searchParams.get('asset') || 'btc').toLowerCase();
    const interval = parseInt(searchParams.get('interval') || '5');

    if (!['btc', 'eth'].includes(asset)) {
      return NextResponse.json({ error: 'Asset must be btc or eth' }, { status: 400 });
    }
    if (![5].includes(interval)) {
      return NextResponse.json({ error: 'Interval must be 5' }, { status: 400 });
    }

    // Compute the current market window slug (same logic as polymarket_client.py)
    const now = new Date();
    const nowUtc = new Date(now.toISOString());
    const totalMinutes = nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes();
    const minuteAligned = Math.floor(totalMinutes / interval) * interval;
    const windowStart = new Date(Date.UTC(
      nowUtc.getUTCFullYear(),
      nowUtc.getUTCMonth(),
      nowUtc.getUTCDate(),
      Math.floor(minuteAligned / 60),
      minuteAligned % 60,
      0
    ));
    const timestamp = Math.floor(windowStart.getTime() / 1000);
    const slug = `${asset}-updown-${interval}m-${timestamp}`;

    // Fetch market from Gamma API
    const res = await fetch(`${GAMMA_URL}/markets/slug/${slug}`, { next: { revalidate: 0 } });

    if (!res.ok) {
      // Try the next window if current isn't available yet
      const nextTimestamp = timestamp + interval * 60;
      const nextSlug = `${asset}-updown-${interval}m-${nextTimestamp}`;
      const nextRes = await fetch(`${GAMMA_URL}/markets/slug/${nextSlug}`, { next: { revalidate: 0 } });

      if (!nextRes.ok) {
        return NextResponse.json({ error: 'No active market found' }, { status: 404 });
      }

      const market = await nextRes.json();
      return NextResponse.json(formatMarket(market, nextSlug));
    }

    const market = await res.json();

    // If this market is already resolved, try the next window
    if (market.resolved) {
      const nextTimestamp = timestamp + interval * 60;
      const nextSlug = `${asset}-updown-${interval}m-${nextTimestamp}`;
      const nextRes = await fetch(`${GAMMA_URL}/markets/slug/${nextSlug}`, { next: { revalidate: 0 } });

      if (nextRes.ok) {
        const nextMarket = await nextRes.json();
        if (!nextMarket.resolved) {
          return NextResponse.json(formatMarket(nextMarket, nextSlug));
        }
      }
    }

    return NextResponse.json(formatMarket(market, slug));
  } catch (err: any) {
    console.error('Active market error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch active market' },
      { status: 500 }
    );
  }
}

function formatMarket(market: any, slug: string) {
  const clobIds = typeof market.clobTokenIds === 'string'
    ? JSON.parse(market.clobTokenIds)
    : (market.clobTokenIds || []);

  // Parse outcome prices — YES price and NO price
  const outcomePrices = typeof market.outcomePrices === 'string'
    ? JSON.parse(market.outcomePrices)
    : (market.outcomePrices || []);

  return {
    slug,
    question: market.question || '',
    yesTokenId: clobIds[0] || null,
    noTokenId: clobIds[1] || null,
    yesPrice: outcomePrices[0] ? parseFloat(outcomePrices[0]) : 0.5,
    noPrice: outcomePrices[1] ? parseFloat(outcomePrices[1]) : 0.5,
    endTime: market.endDate || null,
    conditionId: market.conditionId || null,
    resolved: !!market.resolved,
    marketId: market.id || null,
  };
}
