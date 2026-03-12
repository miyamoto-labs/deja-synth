import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Bet amount is now dynamic — passed from frontend or read from session

/**
 * POST /api/arcade/record-trade
 * Records a completed arcade trade after the client signed and submitted it via MetaMask.
 * Updates session stats (bets remaining, balance, trade count).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { walletAddress, sessionId, side, orderId, tokenId, slug, entryPrice, marketEndTime, betAmount } = body;

    if (!walletAddress || !sessionId || !side || !orderId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    const address = walletAddress.toLowerCase();
    const supabase = getSupabase();

    // ── Validate session ──
    const { data: session, error: sessionErr } = await supabase
      .from('ep_bot_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('wallet_address', address)
      .eq('mode', 'arcade')
      .eq('status', 'active')
      .single();

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'No active arcade session found' }, { status: 404 });
    }

    if (session.bets_remaining <= 0) {
      return NextResponse.json({ error: 'No bets remaining' }, { status: 400 });
    }

    // ── Check for duplicate bet on SAME market window ──
    if (slug) {
      const { data: duplicateBet } = await supabase
        .from('ep_bot_trades')
        .select('id')
        .eq('session_id', sessionId)
        .eq('market_slug', slug)
        .eq('outcome', 'pending')
        .limit(1)
        .single();

      if (duplicateBet) {
        return NextResponse.json(
          { error: 'You already have a bet on this market window.' },
          { status: 409 }
        );
      }
    }

    // ── Check max concurrent bets (5) ──
    const { count: pendingCount } = await supabase
      .from('ep_bot_trades')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('outcome', 'pending');

    if ((pendingCount || 0) >= 5) {
      return NextResponse.json(
        { error: 'Maximum 5 concurrent bets. Wait for one to resolve.' },
        { status: 429 }
      );
    }

    // ── Determine bet amount (from request, session, or default) ──
    const actualBetAmount = Number(betAmount) || Number(session.bet_amount) || 1;

    // ── Insert trade ──
    const price = Number(entryPrice) || 0.5;
    const size = actualBetAmount / price;
    const marketStr = body.market || session.market || 'BTC-5m';

    const { data: trade, error: tradeErr } = await supabase
      .from('ep_bot_trades')
      .insert({
        session_id: sessionId,
        market: marketStr,
        side,
        amount: actualBetAmount,
        entry_price: price,
        shares: size,
        outcome: 'pending',
        pnl: 0,
        order_id: orderId,
        token_id: tokenId || null,
        condition_id: null,
        market_slug: slug || null,
        spread_fee: 0,
      })
      .select('id')
      .single();

    if (tradeErr) throw tradeErr;

    // ── Update session ──
    const { error: updateErr } = await supabase
      .from('ep_bot_sessions')
      .update({
        bets_remaining: session.bets_remaining - 1,
        current_balance: Number(session.current_balance) - actualBetAmount,
        total_trades: session.total_trades + 1,
      })
      .eq('id', sessionId);

    if (updateErr) console.error('Session update error:', updateErr);

    return NextResponse.json({
      tradeId: trade.id,
      betsRemaining: session.bets_remaining - 1,
      entryPrice: price,
      marketEndTime: marketEndTime || null,
    });
  } catch (err: any) {
    console.error('Record-trade error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to record trade' },
      { status: 500 }
    );
  }
}
