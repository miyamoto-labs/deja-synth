import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/follows/settings
 * Update auto-trade settings for a followed trader.
 * Body: { walletAddress, traderId, auto_trade?, amount_per_trade?, max_daily_trades? }
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { walletAddress, traderId, ...settings } = body;

    if (!walletAddress || !traderId) {
      return NextResponse.json(
        { error: 'Missing walletAddress or traderId' },
        { status: 400 }
      );
    }

    const address = walletAddress.toLowerCase();
    const supabase = getSupabase();

    // Build update object from allowed fields
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (typeof settings.active === 'boolean') updates.active = settings.active;
    if (typeof settings.auto_trade === 'boolean') updates.auto_trade = settings.auto_trade;
    if (typeof settings.amount_per_trade === 'number') {
      updates.amount_per_trade = Math.max(1, Math.min(10000, settings.amount_per_trade));
    }
    if (typeof settings.max_daily_trades === 'number') {
      updates.max_daily_trades = Math.max(1, Math.min(100, settings.max_daily_trades));
    }
    // Copy direction toggles
    if (typeof settings.copy_buy === 'boolean') updates.copy_buy = settings.copy_buy;
    if (typeof settings.copy_sell === 'boolean') updates.copy_sell = settings.copy_sell;
    // Sizing mode
    if (settings.sizing_mode === 'fixed' || settings.sizing_mode === 'percentage') {
      updates.sizing_mode = settings.sizing_mode;
    }
    if (typeof settings.sizing_value === 'number') {
      updates.sizing_value = Math.max(1, Math.min(100, settings.sizing_value));
    }
    // Spend & size limits (null = no limit)
    if (settings.total_spend_limit !== undefined) {
      updates.total_spend_limit = settings.total_spend_limit === null ? null : Math.max(0, settings.total_spend_limit);
    }
    if (settings.max_per_trade !== undefined) {
      updates.max_per_trade = settings.max_per_trade === null ? null : Math.max(1, settings.max_per_trade);
    }
    if (settings.min_trade_size !== undefined) {
      updates.min_trade_size = settings.min_trade_size === null ? null : Math.max(0, settings.min_trade_size);
    }
    if (settings.max_per_market !== undefined) {
      updates.max_per_market = settings.max_per_market === null ? null : Math.max(1, settings.max_per_market);
    }
    // Slippage (price tolerance %)
    if (typeof settings.slippage_buy_pct === 'number') {
      updates.slippage_buy_pct = Math.max(0.5, Math.min(20, settings.slippage_buy_pct));
    }
    if (typeof settings.slippage_sell_pct === 'number') {
      updates.slippage_sell_pct = Math.max(0.5, Math.min(20, settings.slippage_sell_pct));
    }
    // Stop Loss / Take Profit (% from entry, null = disabled)
    if (settings.stop_loss_pct !== undefined) {
      updates.stop_loss_pct = settings.stop_loss_pct === null ? null : Math.max(1, Math.min(95, settings.stop_loss_pct));
    }
    if (settings.take_profit_pct !== undefined) {
      updates.take_profit_pct = settings.take_profit_pct === null ? null : Math.max(1, Math.min(500, settings.take_profit_pct));
    }
    // SL exit buffer (extra % below trigger for GTC limit sell)
    if (typeof settings.sl_buffer_pct === 'number') {
      updates.sl_buffer_pct = Math.max(5, Math.min(50, settings.sl_buffer_pct));
    }

    const { data, error } = await supabase
      .from('ep_user_follows')
      .update(updates)
      .eq('user_wallet', address)
      .eq('trader_id', traderId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, follow: data });
  } catch (err: any) {
    console.error('Follow settings error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to update follow settings' },
      { status: 500 }
    );
  }
}
