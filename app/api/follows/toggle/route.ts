import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/follows/toggle
 * Toggle follow/unfollow for a trader.
 * Body: { walletAddress, traderId, action? }
 *   action: 'activate'   → always set active=true  (used by Copy Now)
 *           'deactivate'  → always set active=false (used by Stop Copying)
 *           'shadow'      → create paused follow (active=true, auto_trade=false)
 *           undefined      → legacy toggle behaviour
 */
export async function POST(request: Request) {
  try {
    const { walletAddress, traderId, action } = await request.json();

    if (!walletAddress || !traderId) {
      return NextResponse.json(
        { error: 'Missing walletAddress or traderId' },
        { status: 400 }
      );
    }

    const address = walletAddress.toLowerCase();
    const supabase = getSupabase();

    // Check if follow already exists
    const { data: existing } = await supabase
      .from('ep_user_follows')
      .select('*')
      .eq('user_wallet', address)
      .eq('trader_id', traderId)
      .single();

    if (existing) {
      // Determine target active state
      const targetActive =
        action === 'activate'   ? true :
        action === 'shadow'     ? true :
        action === 'deactivate' ? false :
        !existing.active; // legacy toggle

      const targetAutoTrade =
        action === 'shadow' ? false : existing.auto_trade;

      const { data: updated, error } = await supabase
        .from('ep_user_follows')
        .update({ active: targetActive, auto_trade: targetAutoTrade, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, follow: updated });
    } else {
      // Create new follow
      // 'shadow' = paused follow (active but auto_trade off)
      // 'deactivate' on non-existent = create inactive
      const { data: created, error } = await supabase
        .from('ep_user_follows')
        .insert({
          user_wallet: address,
          trader_id: traderId,
          active: action !== 'deactivate',
          auto_trade: action !== 'deactivate' && action !== 'shadow',
          amount_per_trade: 10.0,
          max_daily_trades: 5,
          copy_buy: true,
          copy_sell: false,
          sizing_mode: 'fixed',
          sizing_value: 10.0,
          slippage_buy_pct: 10.0,
          slippage_sell_pct: 10.0,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, follow: created });
    }
  } catch (err: any) {
    console.error('Follow toggle error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to toggle follow' },
      { status: 500 }
    );
  }
}
