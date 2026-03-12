import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/watchlist/toggle
 * Add or remove a trader from the user's watchlist.
 * Body: { walletAddress, traderId }
 */
export async function POST(request: Request) {
  try {
    const { walletAddress, traderId } = await request.json();

    if (!walletAddress || !traderId) {
      return NextResponse.json(
        { error: 'Missing walletAddress or traderId' },
        { status: 400 }
      );
    }

    const address = walletAddress.toLowerCase();
    const supabase = getSupabase();

    // Check if already in watchlist
    const { data: existing } = await supabase
      .from('ep_user_watchlist')
      .select('id')
      .eq('user_wallet', address)
      .eq('trader_id', traderId)
      .single();

    if (existing) {
      // Remove from watchlist
      const { error } = await supabase
        .from('ep_user_watchlist')
        .delete()
        .eq('id', existing.id);

      if (error) throw error;
      return NextResponse.json({ success: true, action: 'removed' });
    } else {
      // Add to watchlist
      const { error } = await supabase
        .from('ep_user_watchlist')
        .insert({
          user_wallet: address,
          trader_id: traderId,
        });

      if (error) throw error;
      return NextResponse.json({ success: true, action: 'added' });
    }
  } catch (err: any) {
    console.error('Watchlist toggle error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to toggle watchlist' },
      { status: 500 }
    );
  }
}
