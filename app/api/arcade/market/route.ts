import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GAMMA_URL = 'https://gamma-api.polymarket.com';
const INTERVAL = 5; // 5-minute windows only
const MAX_WINDOW_LOOKAHEAD = 5; // Check up to 5 windows ahead

/**
 * GET /api/arcade/market?market=BTC-5m&side=UP&excludeSlugs=slug1,slug2
 * Looks up the next available Polymarket window for the given asset, skipping
 * any windows the user already has bets on (via excludeSlugs).
 * Enables rapid-fire multi-window stacking.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const marketStr = searchParams.get('market') || 'BTC-5m';
    const side = searchParams.get('side');
    const excludeSlugsStr = searchParams.get('excludeSlugs') || '';

    if (!side || !['UP', 'DOWN'].includes(side)) {
      return NextResponse.json({ error: 'Side must be UP or DOWN' }, { status: 400 });
    }

    const asset = marketStr.toLowerCase().startsWith('eth') ? 'eth' : 'btc';
    const excludeSlugs = new Set(
      excludeSlugsStr ? excludeSlugsStr.split(',').map(s => s.trim()).filter(Boolean) : []
    );

    // Calculate current aligned 5-minute window
    const now = new Date();
    const totalMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const minuteAligned = Math.floor(totalMinutes / INTERVAL) * INTERVAL;
    const windowStart = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
      Math.floor(minuteAligned / 60), minuteAligned % 60, 0
    ));
    const baseTimestamp = Math.floor(windowStart.getTime() / 1000);

    // Try up to MAX_WINDOW_LOOKAHEAD windows, skipping ones already bet on
    let market: any = null;
    let slug = '';
    for (let i = 0; i < MAX_WINDOW_LOOKAHEAD; i++) {
      const ts = baseTimestamp + i * INTERVAL * 60;
      const candidateSlug = `${asset}-updown-${INTERVAL}m-${ts}`;

      // Skip if user already has a bet on this window
      if (excludeSlugs.has(candidateSlug)) continue;

      const res = await fetch(`${GAMMA_URL}/markets/slug/${candidateSlug}`);
      if (res.ok) {
        const m = await res.json();
        if (m.active && !m.resolved) {
          market = m;
          slug = candidateSlug;
          break;
        }
      }
    }

    if (!market) {
      return NextResponse.json(
        { error: 'No active market available. Try again in a moment.' },
        { status: 503 }
      );
    }

    const clobIds = typeof market.clobTokenIds === 'string'
      ? JSON.parse(market.clobTokenIds)
      : (market.clobTokenIds || []);
    const outcomePrices = typeof market.outcomePrices === 'string'
      ? JSON.parse(market.outcomePrices)
      : (market.outcomePrices || []);

    const yesTokenId = clobIds[0];
    const noTokenId = clobIds[1];
    const yesPrice = outcomePrices[0] ? parseFloat(outcomePrices[0]) : 0.5;
    const noPrice = outcomePrices[1] ? parseFloat(outcomePrices[1]) : 0.5;

    const tokenId = side === 'UP' ? yesTokenId : noTokenId;
    const price = side === 'UP' ? yesPrice : noPrice;

    if (!tokenId) {
      return NextResponse.json(
        { error: 'Market token IDs not available' },
        { status: 503 }
      );
    }

    const marketEndTime = new Date(market.endDate).getTime();

    return NextResponse.json({
      tokenId,
      price,
      slug,
      marketEndTime,
      yesPrice,
      noPrice,
      conditionId: market.conditionId || null,
    });
  } catch (err: any) {
    console.error('Arcade market lookup error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to look up market' },
      { status: 500 }
    );
  }
}
