import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auto-trade/dismiss
 * Dismiss a pending auto-trade signal so it won't show again.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { wallet, signalId } = body;

    if (!wallet || !signalId) {
      return NextResponse.json(
        { error: 'Missing wallet or signalId' },
        { status: 400 }
      );
    }

    const sb = getSupabase();

    const { error } = await sb.from('ep_auto_trade_dismissed').upsert(
      {
        user_wallet: wallet.toLowerCase(),
        signal_id: signalId,
      },
      { onConflict: 'user_wallet,signal_id' }
    );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Auto-trade dismiss error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to dismiss signal' },
      { status: 500 }
    );
  }
}
