import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auto-trade/log
 * Log an executed auto-trade for daily limit tracking.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { wallet, signalId, traderId, orderId, amount } = body;

    if (!wallet || !signalId || !traderId) {
      return NextResponse.json(
        { error: 'Missing required fields: wallet, signalId, traderId' },
        { status: 400 }
      );
    }

    const sb = getSupabase();

    const { error } = await sb.from('ep_auto_trade_log').insert({
      user_wallet: wallet.toLowerCase(),
      signal_id: signalId,
      trader_id: traderId,
      order_id: orderId || null,
      amount: amount || 0,
    });

    if (error) throw error;

    // Increment total_spent on the follow record
    if (amount && amount > 0) {
      const { data: follow } = await sb
        .from('ep_user_follows')
        .select('id, total_spent')
        .eq('user_wallet', wallet.toLowerCase())
        .eq('trader_id', traderId)
        .eq('active', true)
        .single();

      if (follow) {
        const newSpent = (parseFloat(follow.total_spent) || 0) + amount;
        await sb.from('ep_user_follows').update({ total_spent: newSpent }).eq('id', follow.id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Auto-trade log error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to log auto-trade' },
      { status: 500 }
    );
  }
}
