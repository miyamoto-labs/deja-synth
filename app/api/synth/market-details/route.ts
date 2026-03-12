import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GAMMA_URL = 'https://gamma-api.polymarket.com';

/**
 * GET /api/synth/market-details?slug=<polymarket-slug>&side=UP|DOWN
 * Resolves a Polymarket slug (from Synth API) into token IDs and prices
 * via the Gamma API. Returns everything needed to place a trade.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const side = searchParams.get('side');

    if (!slug) {
      return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 });
    }
    if (!side || !['UP', 'DOWN'].includes(side)) {
      return NextResponse.json({ error: 'Missing or invalid side (UP|DOWN)' }, { status: 400 });
    }

    // Fetch market from Gamma API
    const res = await fetch(`${GAMMA_URL}/markets/slug/${slug}`, {
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      console.error(`[Synth] Gamma lookup failed for slug "${slug}": HTTP ${res.status}`);
      return NextResponse.json(
        { error: `Market not found on Polymarket (slug: ${slug})` },
        { status: 404 }
      );
    }

    const market = await res.json();

    // Parse token IDs and prices
    const clobIds =
      typeof market.clobTokenIds === 'string'
        ? JSON.parse(market.clobTokenIds)
        : market.clobTokenIds || [];

    const outcomePrices =
      typeof market.outcomePrices === 'string'
        ? JSON.parse(market.outcomePrices)
        : market.outcomePrices || [];

    if (clobIds.length < 2) {
      return NextResponse.json(
        { error: 'Market missing CLOB token IDs' },
        { status: 500 }
      );
    }

    // YES (index 0) = UP, NO (index 1) = DOWN
    const tokenId = side === 'UP' ? clobIds[0] : clobIds[1];
    const price =
      side === 'UP'
        ? parseFloat(outcomePrices[0] || '0.5')
        : parseFloat(outcomePrices[1] || '0.5');

    const yesPrice = parseFloat(outcomePrices[0] || '0.5');
    const noPrice = parseFloat(outcomePrices[1] || '0.5');

    // Parse end date
    const marketEndTime = market.endDate
      ? new Date(market.endDate).getTime()
      : null;

    return NextResponse.json({
      tokenId,
      price,
      slug,
      marketEndTime,
      yesPrice,
      noPrice,
      conditionId: market.conditionId || null,
      resolved: !!market.resolved,
      active: !!market.active,
      question: market.question || null,
    });
  } catch (err: any) {
    console.error('[Synth] Market details error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch market details' },
      { status: 500 }
    );
  }
}
