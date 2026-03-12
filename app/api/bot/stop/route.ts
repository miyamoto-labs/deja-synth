import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/bot/stop
 * Stop an active bot session. Marks it as stopped in Supabase.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { walletAddress, sessionId } = body;

    if (!walletAddress || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, sessionId' },
        { status: 400 }
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    const address = walletAddress.toLowerCase();
    const supabase = getSupabase();

    // ── Fetch session and verify ownership ──
    const { data: session, error: fetchError } = await supabase
      .from('ep_bot_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('wallet_address', address)
      .single();

    if (fetchError || !session) {
      return NextResponse.json(
        { error: 'Session not found or you do not own it' },
        { status: 404 }
      );
    }

    if (session.status === 'stopped' || session.status === 'expired') {
      return NextResponse.json(
        { error: `Session is already ${session.status}` },
        { status: 409 }
      );
    }

    // ── Stop the session ──
    const { error: updateError } = await supabase
      .from('ep_bot_sessions')
      .update({
        status: 'stopped',
        stopped_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      finalBalance: Number(session.current_balance),
      totalPnl: Number(session.total_pnl),
      totalTrades: session.total_trades,
      wins: session.wins,
      losses: session.losses,
    });
  } catch (err: any) {
    console.error('Bot stop error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to stop bot session' },
      { status: 500 }
    );
  }
}
