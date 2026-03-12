import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/watchlist/list?walletAddress=0x...
 * Returns all watchlisted traders for a user, joined with trader details.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Missing walletAddress query parameter' },
        { status: 400 }
      );
    }

    const address = walletAddress.toLowerCase();
    const supabase = getSupabase();

    // Fetch watchlist entries
    const { data: watchlist, error } = await supabase
      .from('ep_user_watchlist')
      .select('id, trader_id, created_at')
      .eq('user_wallet', address)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!watchlist || watchlist.length === 0) {
      return NextResponse.json({ watchlist: [] });
    }

    // Fetch trader details for all watchlisted traders
    const traderIds = watchlist.map((w) => w.trader_id);
    const { data: traders } = await supabase
      .from('ep_tracked_traders')
      .select('id, alias, wallet_address, roi, win_rate, total_pnl, trade_count, bankroll_tier, trading_style, composite_rank, category')
      .in('id', traderIds);

    // Create lookup map
    const traderMap = new Map((traders || []).map((t) => [t.id, t]));

    // Merge watchlist with trader details
    const enriched = watchlist
      .map((w) => ({
        ...w,
        trader: traderMap.get(w.trader_id) || null,
      }))
      .filter((w) => w.trader !== null); // Skip entries with deleted traders

    return NextResponse.json({ watchlist: enriched });
  } catch (err: any) {
    console.error('Watchlist list error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch watchlist' },
      { status: 500 }
    );
  }
}
