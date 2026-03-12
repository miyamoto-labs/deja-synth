import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const GAMMA_API = 'https://gamma-api.polymarket.com';

/**
 * Resolve missing markets from Gamma API by slug.
 * Returns a Map of slug → { question, eventSlug, outcomePrices }.
 */
async function resolveMarketsFromGamma(slugs: string[]): Promise<Map<string, any>> {
  const resolved = new Map<string, any>();
  if (slugs.length === 0) return resolved;

  // Gamma API supports up to ~20 slugs via repeated calls; batch in parallel
  const fetches = slugs.slice(0, 10).map(async (slug) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${GAMMA_API}/markets?slug=${encodeURIComponent(slug)}&limit=1`, {
        next: { revalidate: 300 },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return;
      const data = await res.json();
      const m = Array.isArray(data) ? data[0] : data;
      if (!m) return;

      const eventSlug = m.events?.[0]?.slug || '';
      resolved.set(slug, {
        question: m.question || slug,
        eventSlug,
        yesPrice: parseFloat(JSON.parse(m.outcomePrices || '[]')[0]) || null,
        noPrice: parseFloat(JSON.parse(m.outcomePrices || '[]')[1]) || null,
        volume: parseFloat(m.volume) || 0,
        endDate: m.endDate || null,
      });
    } catch { /* skip individual failures */ }
  });

  await Promise.all(fetches);
  return resolved;
}

/**
 * GET /api/traders/activity
 * Returns the latest trades from all tracked traders, enriched with
 * trader info and market details (question, Polymarket slug, prices).
 *
 * Query params:
 *   limit   — max trades to return (default: 50, max: 200)
 *   hours   — how far back to look (default: 24, max: 168)
 *   trader  — filter by trader_id (optional)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const hours = Math.min(parseInt(searchParams.get('hours') || '24'), 168);
    const traderId = searchParams.get('trader') || null;

    const sb = getSupabase();
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    // 1. Fetch recent trades
    let query = sb
      .from('ep_trader_trades')
      .select('*')
      .gte('timestamp', cutoff)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (traderId) {
      query = query.eq('trader_id', traderId);
    }

    const { data: trades, error } = await query;
    if (error) throw error;
    if (!trades || trades.length === 0) {
      return NextResponse.json(
        { activity: [], count: 0, cutoff, timestamp: new Date().toISOString() },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
      );
    }

    // 2. Batch-fetch related traders and markets (no FK required)
    const traderIds = [...new Set(trades.map((t: any) => t.trader_id).filter(Boolean))];
    const marketIds = [...new Set(trades.map((t: any) => t.market_id).filter(Boolean))];

    const [tradersRes, marketsRes] = await Promise.all([
      traderIds.length > 0
        ? sb.from('ep_tracked_traders')
            .select('id, alias, wallet_address, bankroll_tier, trading_style, roi, win_rate, total_pnl')
            .in('id', traderIds)
        : Promise.resolve({ data: [] }),
      marketIds.length > 0
        ? sb.from('ep_markets_raw')
            .select('market_id, question, slug, yes_price, no_price, volume, end_date, event_slug')
            .in('market_id', marketIds)
        : Promise.resolve({ data: [] }),
    ]);

    const tradersMap = new Map((tradersRes.data || []).map((t: any) => [t.id, t]));
    const marketsMap = new Map((marketsRes.data || []).map((m: any) => [m.market_id, m]));

    // 3. Skip Gamma API resolution — too slow, causes Vercel timeouts
    const gammaMap = new Map();

    // 4. Reshape for the frontend
    const activity = trades.map((trade: any) => {
      const trader: any = tradersMap.get(trade.trader_id) || {};
      const market: any = marketsMap.get(trade.market_id) || {};
      const gamma: any = gammaMap.get(trade.market_id) || {};

      // Prefer event_slug from DB, then Gamma, for correct Polymarket URLs
      const eventSlug = market.event_slug || gamma.eventSlug || '';
      const polymarketUrl = eventSlug
        ? `https://polymarket.com/event/${eventSlug}`
        : '';

      return {
        id: trade.id,
        traderId: trade.trader_id,
        marketId: trade.market_id,
        direction: trade.direction,
        amount: trade.amount,
        price: trade.price,
        tradeType: trade.trade_type || 'entry',
        timestamp: trade.timestamp,
        createdAt: trade.created_at,
        traderAlias: trader.alias || trader.wallet_address?.slice(0, 10) || 'Unknown',
        traderWallet: trader.wallet_address || '',
        traderTier: trader.bankroll_tier || '',
        traderStyle: trader.trading_style || '',
        traderRoi: trader.roi || 0,
        traderWinRate: trader.win_rate || 0,
        traderPnl: trader.total_pnl || 0,
        question: market.question || gamma.question || trade.market_id || 'Unknown Market',
        marketSlug: trade.market_id || '',
        polymarketUrl,
        yesPrice: market.yes_price || gamma.yesPrice || null,
        noPrice: market.no_price || gamma.noPrice || null,
        volume: market.volume || gamma.volume || 0,
        endDate: market.end_date || gamma.endDate || null,
      };
    });

    return NextResponse.json(
      { activity, count: activity.length, cutoff, timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
    );
  } catch (err: any) {
    console.error('Activity API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
