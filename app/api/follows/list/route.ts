import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * GET /api/follows/list?walletAddress=0x...
 * Returns all active follows for a user, joined with trader details.
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

    // Fetch active follows
    const { data: follows, error } = await supabase
      .from('ep_user_follows')
      .select('*')
      .eq('user_wallet', address)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Follows list query error:', error);
      throw error;
    }

    // If no follows, return empty
    if (!follows || follows.length === 0) {
      return NextResponse.json({ follows: [] });
    }

    // Fetch trader details for all followed traders
    const traderIds = follows.map((f) => f.trader_id);
    const { data: traders } = await supabase
      .from('ep_tracked_traders')
      .select('id, alias, wallet_address, roi, win_rate, total_pnl, bankroll_tier, trading_style, trade_count, composite_rank, markets_traded, estimated_bankroll, category, profile_summary')
      .in('id', traderIds);

    // Create a lookup map
    const traderMap = new Map((traders || []).map((t) => [t.id, t]));

    // Merge
    const enriched = follows.map((f) => ({
      ...f,
      trader: traderMap.get(f.trader_id) || null,
    }));

    return NextResponse.json({ follows: enriched });
  } catch (err: any) {
    console.error('Follows list error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch follows' },
      { status: 500 }
    );
  }
}
