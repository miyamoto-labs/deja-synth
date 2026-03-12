import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/bot/status?wallet=0x...
 * Returns the current bot session status, P&L, time remaining, and active bet.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json(
        { error: 'Invalid or missing wallet address' },
        { status: 400 }
      );
    }

    const address = wallet.toLowerCase();
    const supabase = getSupabase();

    // ── Fetch latest active/paused/pending session ──
    const { data: session, error } = await supabase
      .from('ep_bot_sessions')
      .select('*')
      .eq('wallet_address', address)
      .in('status', ['pending', 'active', 'paused'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !session) {
      return NextResponse.json({ active: false });
    }

    // ── Check auto-expiry ──
    const timeRemaining = session.total_seconds - (session.used_seconds || 0);

    if (timeRemaining <= 0) {
      // Auto-expire the session
      await supabase
        .from('ep_bot_sessions')
        .update({
          status: 'expired',
          stopped_at: new Date().toISOString(),
        })
        .eq('id', session.id);

      return NextResponse.json({
        active: false,
        expired: true,
        finalBalance: session.current_balance,
        totalPnl: session.total_pnl,
      });
    }

    // ── Fetch ALL pending trades (multi-window support) ──
    const { data: pendingTrades } = await supabase
      .from('ep_bot_trades')
      .select('id, side, entry_price, amount, market, market_slug, created_at')
      .eq('session_id', session.id)
      .eq('outcome', 'pending')
      .order('created_at', { ascending: true })
      .limit(5);

    const activeBets = (pendingTrades || []).map((t: any) => ({
      id: t.id,
      side: t.side,
      entryPrice: Number(t.entry_price),
      amount: Number(t.amount),
      market: t.market,
      slug: t.market_slug,
      createdAt: t.created_at,
    }));

    // Backward compat: activeBet = first pending trade
    const activeBet = activeBets.length > 0 ? activeBets[0] : null;

    return NextResponse.json({
      active: true,
      session: {
        id: session.id,
        status: session.status,
        plan: session.plan,
        market: session.market,
        bankroll: Number(session.bankroll_usdc),
        currentBalance: Number(session.current_balance),
        totalPnl: Number(session.total_pnl),
        trades: session.total_trades,
        wins: session.wins,
        losses: session.losses,
        timeRemaining,
        totalTime: session.total_seconds,
        startedAt: session.started_at,
        botWalletAddress: session.bot_wallet_address,
        mode: session.mode || 'auto',
        betsRemaining: session.bets_remaining || 0,
        betAmount: Number(session.bet_amount) || 1,
      },
      activeBet,
      activeBets,
    });
  } catch (err: any) {
    console.error('Bot status error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch bot status' },
      { status: 500 }
    );
  }
}
