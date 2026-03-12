import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CLOB_HOST = 'https://clob.polymarket.com';

/**
 * GET /api/polymarket/orderbook?tokenId=xxx
 * Public order book data — no authentication needed.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenId = searchParams.get('tokenId');

  if (!tokenId) {
    return NextResponse.json({ error: 'tokenId is required' }, { status: 400 });
  }

  try {
    const res = await fetch(`${CLOB_HOST}/book?token_id=${encodeURIComponent(tokenId)}`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 5 }, // Cache 5 seconds
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `CLOB API error: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    // CLOB API returns bids ascending (worst first) and asks descending (worst first).
    // Re-sort so bids[0] = best/highest bid, asks[0] = best/lowest ask.
    const allBids = (data.bids || []).map((b: any) => ({
      price: parseFloat(b.price),
      size: parseFloat(b.size),
    }));
    allBids.sort((a: any, b: any) => b.price - a.price); // descending — best bid first
    const bids = allBids.slice(0, 6);

    const allAsks = (data.asks || []).map((a: any) => ({
      price: parseFloat(a.price),
      size: parseFloat(a.size),
    }));
    allAsks.sort((a: any, b: any) => a.price - b.price); // ascending — best ask first
    const asks = allAsks.slice(0, 6);

    const spread = asks.length > 0 && bids.length > 0
      ? parseFloat((asks[0].price - bids[0].price).toFixed(4))
      : null;

    return NextResponse.json({
      bids,
      asks,
      spread,
      lastTradePrice: data.last_trade_price ? parseFloat(data.last_trade_price) : null,
      timestamp: data.timestamp || new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Order book fetch error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch order book' },
      { status: 500 }
    );
  }
}
