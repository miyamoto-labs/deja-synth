import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

const DATA_API = 'https://data-api.polymarket.com';

/**
 * POST /api/traders/add-custom
 * Accepts any Polymarket wallet address, fetches real stats from the Data API
 * (activity trades + closed positions), and upserts into ep_tracked_traders.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { walletAddress, addedBy, category } = body;

    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    const address = walletAddress.toLowerCase();
    const supabase = getSupabase();

    // ── Check if already tracked ──
    const { data: existing } = await supabase
      .from('ep_tracked_traders')
      .select('*')
      .eq('wallet_address', address)
      .limit(1)
      .single();

    if (existing) {
      if (category && existing.category !== category) {
        await supabase
          .from('ep_tracked_traders')
          .update({ category, source: 'user_added' })
          .eq('id', existing.id);
        existing.category = category;
        existing.source = 'user_added';
      }
      return NextResponse.json({ trader: existing, isNew: false });
    }

    // ── Resolve username from Polymarket profile page ──
    let alias = `${address.slice(0, 6)}...${address.slice(-4)}`;
    try {
      const profileRes = await fetch(`https://polymarket.com/profile/${address}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 0 },
      });
      if (profileRes.ok) {
        const html = await profileRes.text();
        const match = html.match(/__NEXT_DATA__.*?({.*?})<\/script>/s);
        if (match) {
          const data = JSON.parse(match[1]);
          const props = data?.props?.pageProps || {};
          if (props.username) alias = props.username;
        }
      }
    } catch { /* silent */ }

    // ── Fetch trade activity (up to 500 trades) ──
    let trades: any[] = [];
    try {
      const actRes = await fetch(
        `${DATA_API}/activity?user=${address}&limit=500&type=TRADE`,
        { next: { revalidate: 0 } }
      );
      if (actRes.ok) {
        const data = await actRes.json();
        trades = Array.isArray(data) ? data : [];
      }
    } catch { /* silent */ }

    // If the profile had a username, also check activity name field
    if (trades.length > 0 && alias.startsWith('0x')) {
      const name = trades[0].name || trades[0].pseudonym;
      if (name) alias = name;
    }

    // ── Fetch closed positions (win/loss data with realizedPnl) ──
    let closedPositions: any[] = [];
    try {
      const closedRes = await fetch(
        `${DATA_API}/closed-positions?user=${address}&limit=200`,
        { next: { revalidate: 0 } }
      );
      if (closedRes.ok) {
        const data = await closedRes.json();
        closedPositions = Array.isArray(data) ? data : [];
      }
    } catch { /* silent */ }

    // ── Compute stats from closed positions ──
    let wins = 0;
    let losses = 0;
    let totalRealizedPnl = 0;
    let totalCost = 0;
    const closedMarkets = new Set<string>();

    for (const pos of closedPositions) {
      const rpnl = parseFloat(pos.realizedPnl || '0');
      const bought = parseFloat(pos.totalBought || '0');
      totalRealizedPnl += rpnl;
      totalCost += bought;
      if (rpnl > 0) wins++;
      else losses++;
      const slug = pos.slug || '';
      if (slug) closedMarkets.add(slug);
    }

    // ── Compute stats from trade activity ──
    const tradeMarkets = new Set<string>();
    let totalVolume = 0;
    const tradeSizes: number[] = [];

    for (const t of trades) {
      const usdcSize = parseFloat(t.usdcSize || '0');
      totalVolume += usdcSize;
      if (usdcSize > 0) tradeSizes.push(usdcSize);
      const slug = t.slug || t.eventSlug || '';
      if (slug) tradeMarkets.add(slug);
    }

    // Merge market sets
    const allMarkets = new Set([...closedMarkets, ...tradeMarkets]);

    const tradeCount = closedPositions.length > 0
      ? closedPositions.length
      : trades.length;
    const winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0;
    const avgTradeSize = tradeSizes.length > 0
      ? tradeSizes.reduce((a, b) => a + b, 0) / tradeSizes.length
      : 0;
    const roi = totalCost > 0 ? (totalRealizedPnl / totalCost) * 100 : 0;

    // ── Classify tier by average trade size ──
    let bankrollTier = 'micro';
    if (avgTradeSize >= 20000) bankrollTier = 'whale';
    else if (avgTradeSize >= 2000) bankrollTier = 'mid';
    else if (avgTradeSize >= 200) bankrollTier = 'small';

    // ── Classify trading style ──
    let tradingStyle = 'unknown';
    if (tradeCount >= 3) {
      if (avgTradeSize >= 10000) tradingStyle = 'whale';
      else if (tradeCount <= 10 && winRate >= 65) tradingStyle = 'sniper';
      else if (tradeCount >= 50) tradingStyle = 'degen';
      else tradingStyle = 'grinder';
    }

    // ── Upsert into ep_tracked_traders ──
    const traderData = {
      wallet_address: address,
      alias,
      total_pnl: Math.round(totalRealizedPnl * 100) / 100,
      pnl_30d: 0,
      pnl_7d: 0,
      win_rate: Math.round(winRate * 10) / 10,
      trade_count: tradeCount,
      avg_position_size: Math.round(avgTradeSize * 100) / 100,
      roi: Math.round(roi * 100) / 100,
      bankroll_tier: bankrollTier,
      trading_style: tradingStyle,
      estimated_bankroll: Math.round(totalVolume * 100) / 100,
      markets_traded: allMarkets.size,
      composite_rank: 0,
      active: true,
      source: 'user_added',
      category: category || null,
      last_updated: new Date().toISOString(),
    };

    const { data: trader, error: insertErr } = await supabase
      .from('ep_tracked_traders')
      .insert(traderData)
      .select('*')
      .single();

    if (insertErr) {
      const { data: retry } = await supabase
        .from('ep_tracked_traders')
        .select('*')
        .eq('wallet_address', address)
        .single();

      if (retry) {
        return NextResponse.json({ trader: retry, isNew: false });
      }
      throw insertErr;
    }

    return NextResponse.json({ trader, isNew: true });
  } catch (err: any) {
    console.error('Add custom trader error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to add trader' },
      { status: 500 }
    );
  }
}
