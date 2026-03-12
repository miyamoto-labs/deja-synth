import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

const GAMMA_URL = 'https://gamma-api.polymarket.com';
// Bet amount is now dynamic — passed from frontend or read from session

/**
 * POST /api/bot/click-bet
 * Records an arcade bet against a live Polymarket market.
 * Beta mode: simulated — no real CLOB order, resolution based on actual market outcome.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { walletAddress, sessionId, side, betAmount } = body;

    if (!walletAddress || !sessionId || !side) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, sessionId, side' },
        { status: 400 }
      );
    }

    if (!['UP', 'DOWN'].includes(side)) {
      return NextResponse.json({ error: 'Side must be UP or DOWN' }, { status: 400 });
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

    // ── Resolve current market ──
    const marketStr = session.market || 'BTC-5m';
    const asset = marketStr.toLowerCase().startsWith('eth') ? 'eth' : 'btc';
    const interval = 5;

    const now = new Date();
    const totalMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const minuteAligned = Math.floor(totalMinutes / interval) * interval;
    const windowStart = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
      Math.floor(minuteAligned / 60), minuteAligned % 60, 0
    ));
    const timestamp = Math.floor(windowStart.getTime() / 1000);

    // Try current window, then next
    let market: any = null;
    let slug = '';
    for (const ts of [timestamp, timestamp + interval * 60]) {
      slug = `${asset}-updown-${interval}m-${ts}`;
      const res = await fetch(`${GAMMA_URL}/markets/slug/${slug}`);
      if (res.ok) {
        const m = await res.json();
        if (m.active && !m.resolved) {
          market = m;
          break;
        }
      }
    }

    if (!market) {
      return NextResponse.json({ error: 'No active market available. Try again in a moment.' }, { status: 503 });
    }

    const clobIds = typeof market.clobTokenIds === 'string'
      ? JSON.parse(market.clobTokenIds)
      : (market.clobTokenIds || []);
    const outcomePrices = typeof market.outcomePrices === 'string'
      ? JSON.parse(market.outcomePrices)
      : (market.outcomePrices || []);

    const yesTokenId = clobIds[0];
    const noTokenId = clobIds[1];
    const yesPrice = outcomePrices[0] ? parseFloat(outcomePrices[0]) : 0.5;
    const noPrice = outcomePrices[1] ? parseFloat(outcomePrices[1]) : 0.5;

    // UP = buy YES token, DOWN = buy NO token
    const tokenId = side === 'UP' ? yesTokenId : noTokenId;
    const marketPrice = side === 'UP' ? yesPrice : noPrice;

    if (!tokenId) {
      return NextResponse.json({ error: 'Market token IDs not available' }, { status: 503 });
    }

    // ── Determine bet amount (from request, session, or default) ──
    const actualBetAmount = Number(betAmount) || Number(session.bet_amount) || 1;

    // ── Simulation mode (beta): no real CLOB order ──
    const size = actualBetAmount / marketPrice;
    const orderId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const displayedPrice = marketPrice;
    const spreadFee = 0;

    // ── Calculate market end time ──
    const marketEndTime = new Date(market.endDate).getTime();

    // ── Insert trade ──
    const { data: trade, error: tradeErr } = await supabase
      .from('ep_bot_trades')
      .insert({
        session_id: sessionId,
        market: marketStr,
        side,
        amount: actualBetAmount,
        entry_price: displayedPrice,
        shares: size,
        outcome: 'pending',
        pnl: 0,
        order_id: orderId,
        token_id: tokenId,
        condition_id: market.conditionId || null,
        market_slug: slug,
        spread_fee: spreadFee,
      })
      .select('id')
      .single();

    if (tradeErr) throw tradeErr;

    // ── Update session: decrement bets + balance, increment trades ──
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
      entryPrice: displayedPrice,
      realPrice: marketPrice,
      tokenId,
      slug,
      marketEndTime,
      orderId,
    });
  } catch (err: any) {
    console.error('Click-bet error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to place bet' },
      { status: 500 }
    );
  }
}
