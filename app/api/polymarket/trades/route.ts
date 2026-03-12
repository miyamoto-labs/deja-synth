import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CLOB_HOST = 'https://clob.polymarket.com';

/**
 * GET /api/polymarket/trades?conditionId=xxx
 * Public live trade feed — no authentication needed.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const conditionId = searchParams.get('conditionId');

  if (!conditionId) {
    return NextResponse.json({ error: 'conditionId is required' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${CLOB_HOST}/live-activity/events/${encodeURIComponent(conditionId)}`,
      {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 5 },
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `CLOB API error: ${res.status}` },
        { status: res.status }
      );
    }

    const events = await res.json();

    // Normalize and limit to last 20 trades
    const trades = (Array.isArray(events) ? events : [])
      .slice(0, 20)
      .map((e: any) => ({
        time: e.timestamp,
        side: e.side, // 'BUY' or 'SELL'
        outcome: e.outcome, // 'Yes' or 'No'
        price: parseFloat(e.price),
        size: parseFloat(e.size),
        user: e.user?.pseudonym || e.user?.username || 'anon',
      }));

    return NextResponse.json({ trades });
  } catch (err: any) {
    console.error('Trade feed fetch error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch trades' },
      { status: 500 }
    );
  }
}
