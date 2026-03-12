import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/public-portfolio
 * Returns EasyPoly's system trades (public, no auth required).
 * This is the "Bet Our Picks" transparency endpoint.
 */
export async function GET() {
  try {
    const sb = getSupabase();

    // Fetch all system trades, most recent first
    const { data: trades, error } = await sb
      .from('ep_system_trades')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Enrich with market data
    const marketIds = Array.from(new Set((trades || []).map((t: any) => t.market_id)));
    let marketsMap: Record<string, any> = {};

    if (marketIds.length > 0) {
      const { data: markets } = await sb
        .from('ep_markets_raw')
        .select('market_id, question, category, yes_price, no_price')
        .in('market_id', marketIds);

      for (const m of markets || []) {
        marketsMap[m.market_id] = m;
      }
    }

    const enriched = (trades || []).map((t: any) => ({
      ...t,
      market: marketsMap[t.market_id] || null,
      currentPrice: marketsMap[t.market_id]
        ? (t.direction === 'YES'
          ? marketsMap[t.market_id].yes_price
          : marketsMap[t.market_id].no_price)
        : null,
    }));

    // Compute aggregate stats
    const activeTrades = enriched.filter((t: any) => t.status === 'active');
    const closedTrades = enriched.filter((t: any) => t.status !== 'active');
    const totalInvested = enriched.reduce((s: number, t: any) => s + Number(t.amount), 0);
    const totalPnl = closedTrades.reduce((s: number, t: any) => s + Number(t.pnl || 0), 0);
    const wins = closedTrades.filter((t: any) => Number(t.pnl) > 0).length;
    const winRate = closedTrades.length > 0 ? (wins / closedTrades.length * 100) : 0;

    return NextResponse.json({
      trades: enriched,
      stats: {
        totalTrades: enriched.length,
        activeTrades: activeTrades.length,
        closedTrades: closedTrades.length,
        totalInvested: Math.round(totalInvested * 100) / 100,
        totalPnl: Math.round(totalPnl * 100) / 100,
        winRate: Math.round(winRate * 10) / 10,
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (err: any) {
    console.error('Public portfolio error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
