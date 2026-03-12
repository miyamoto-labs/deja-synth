import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/bot/trades?wallet=0x...&sessionId=uuid
 * Returns trade history for a bot session.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');
    const sessionId = searchParams.get('sessionId');

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json(
        { error: 'Invalid or missing wallet address' },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId parameter' },
        { status: 400 }
      );
    }

    const address = wallet.toLowerCase();
    const supabase = getSupabase();

    // ── Verify session ownership ──
    const { data: session, error: sessionError } = await supabase
      .from('ep_bot_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('wallet_address', address)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found or you do not own it' },
        { status: 404 }
      );
    }

    // ── Fetch trades ──
    const { data: trades, error: tradesError } = await supabase
      .from('ep_bot_trades')
      .select('id, market, side, amount, entry_price, shares, outcome, pnl, momentum, edge, synthdata_prob, created_at, resolved_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (tradesError) throw tradesError;

    return NextResponse.json({
      trades: (trades || []).map((t) => ({
        id: t.id,
        market: t.market,
        side: t.side,
        amount: Number(t.amount),
        entryPrice: Number(t.entry_price),
        shares: Number(t.shares),
        outcome: t.outcome,
        pnl: Number(t.pnl),
        momentum: Number(t.momentum),
        edge: Number(t.edge),
        synthdataProb: Number(t.synthdata_prob),
        createdAt: t.created_at,
        resolvedAt: t.resolved_at,
      })),
    });
  } catch (err: any) {
    console.error('Bot trades error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch trades' },
      { status: 500 }
    );
  }
}
