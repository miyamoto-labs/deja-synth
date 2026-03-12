import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

const GAMMA_URL = 'https://gamma-api.polymarket.com';

/**
 * POST /api/bot/resolve-bet
 * Resolves an arcade bet after the market window closes.
 * Checks Polymarket resolution, updates trade outcome + session stats.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { walletAddress, sessionId, tradeId } = body;

    if (!walletAddress || !sessionId || !tradeId) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, sessionId, tradeId' },
        { status: 400 }
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    const address = walletAddress.toLowerCase();
    const supabase = getSupabase();

    // ── Fetch session ──
    const { data: session, error: sessionErr } = await supabase
      .from('ep_bot_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('wallet_address', address)
      .single();

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // ── Fetch trade ──
    const { data: trade, error: tradeErr } = await supabase
      .from('ep_bot_trades')
      .select('*')
      .eq('id', tradeId)
      .eq('session_id', sessionId)
      .eq('outcome', 'pending')
      .single();

    if (tradeErr || !trade) {
      return NextResponse.json({ error: 'Pending trade not found' }, { status: 404 });
    }

    // ── Check timing — market should be past its end time ──
    const tradeAge = Date.now() - new Date(trade.created_at).getTime();
    const slug = trade.market_slug || '';
    const marketStr = trade.market || 'BTC-5m';

    // Detect interval from slug pattern (Synth markets use -1h- or -15m- in slug)
    let intervalMs = 5 * 60 * 1000; // default 5m for legacy arcade
    if (slug.includes('-1h-') || marketStr.includes('-1h')) {
      intervalMs = 60 * 60 * 1000; // 1 hour
    } else if (slug.includes('-15m-') || marketStr.includes('-15m')) {
      intervalMs = 15 * 60 * 1000; // 15 minutes
    }

    const graceMs = 10 * 1000; // 10s grace window

    if (tradeAge < intervalMs - graceMs) {
      return NextResponse.json(
        { pending: true, message: 'Market not yet closed. Wait for the timer.' },
        { status: 200 }
      );
    }

    // ── Fetch market resolution from Gamma API ──
    if (!slug) {
      // Stale bet without slug — resolve as push
      return resolveTrade(supabase, trade, session, 'push', 0);
    }

    const res = await fetch(`${GAMMA_URL}/markets/slug/${slug}`);
    if (!res.ok) {
      // Market not found — might not be resolved yet, retry
      // Give longer grace for 1h markets (5min), shorter for 5min markets (2min)
      const retryWindowMs = intervalMs >= 3600_000 ? 300_000 : 120_000;
      if (tradeAge < intervalMs + retryWindowMs) {
        return NextResponse.json({ pending: true, message: 'Waiting for market resolution...' });
      }
      // Been too long — resolve as push
      return resolveTrade(supabase, trade, session, 'push', 0);
    }

    const market = await res.json();

    if (!market.resolved) {
      // Market exists but not resolved yet
      const retryWindowMs2 = intervalMs >= 3600_000 ? 300_000 : 120_000;
      if (tradeAge < intervalMs + retryWindowMs2) {
        return NextResponse.json({ pending: true, message: 'Waiting for market resolution...' });
      }
      // Been past retry window and still unresolved — resolve as push
      return resolveTrade(supabase, trade, session, 'push', 0);
    }

    // ── Determine outcome ──
    // Resolution: market.resolutionSource tells us if BTC went UP or DOWN
    // outcomePrices after resolution: winner = "1", loser = "0"
    const outcomePrices = typeof market.outcomePrices === 'string'
      ? JSON.parse(market.outcomePrices)
      : (market.outcomePrices || []);

    // YES (index 0) = UP won, NO (index 1) = DOWN won
    const yesWon = parseFloat(outcomePrices[0] || '0') > 0.5;
    const userPickedUp = trade.side === 'UP';

    const won = (userPickedUp && yesWon) || (!userPickedUp && !yesWon);
    const outcome = won ? 'won' : 'lost';

    // PnL: user paid $1 at their entry price. If won, shares pay out $1 each.
    // Profit = shares * 1 - bet_amount = (1/price) * 1 - 1 = (1/price - 1)
    // But we use the REAL execution price (without spread) for actual PnL
    const realEntryPrice = Number(trade.entry_price) - (Number(trade.spread_fee) / Number(trade.shares));
    const pnl = won
      ? Number(trade.shares) * 1 - Number(trade.amount) // shares pay out $1 each
      : -Number(trade.amount);

    return resolveTrade(supabase, trade, session, outcome, pnl, won ? 1 : undefined);
  } catch (err: any) {
    console.error('Resolve-bet error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to resolve bet' },
      { status: 500 }
    );
  }
}

async function resolveTrade(
  supabase: any,
  trade: any,
  session: any,
  outcome: 'won' | 'lost' | 'push',
  pnl: number,
  resolutionPrice?: number,
) {
  const now = new Date().toISOString();

  // ── Update trade ──
  await supabase
    .from('ep_bot_trades')
    .update({
      outcome,
      pnl,
      resolved_at: now,
      resolution_price: resolutionPrice ?? null,
    })
    .eq('id', trade.id);

  // ── Update session stats ──
  // On bet placement: balance was already decremented by $1
  // On win: return bet ($1) + profit → add (1 + pnl) back
  // On loss: no change (already deducted)
  // On push: return bet ($1) → add 1 back
  let balanceAdjust = 0;
  if (outcome === 'won') {
    balanceAdjust = Number(trade.amount) + pnl; // $1 + profit
  } else if (outcome === 'push') {
    balanceAdjust = Number(trade.amount); // refund $1
  }

  const newBalance = Number(session.current_balance) + balanceAdjust;
  const newPnl = Number(session.total_pnl) + pnl;
  const newWins = session.wins + (outcome === 'won' ? 1 : 0);
  const newLosses = session.losses + (outcome === 'lost' ? 1 : 0);

  // Check if session should auto-end
  const { data: remainingPending } = await supabase
    .from('ep_bot_trades')
    .select('id')
    .eq('session_id', session.id)
    .eq('outcome', 'pending')
    .neq('id', trade.id)
    .limit(1);

  const noPendingLeft = !remainingPending || remainingPending.length === 0;
  const sessionEnded = session.bets_remaining <= 0 && noPendingLeft;

  const sessionUpdate: any = {
    current_balance: newBalance,
    total_pnl: newPnl,
    wins: newWins,
    losses: newLosses,
  };

  if (sessionEnded) {
    sessionUpdate.status = 'stopped';
    sessionUpdate.stopped_at = now;
  }

  await supabase
    .from('ep_bot_sessions')
    .update(sessionUpdate)
    .eq('id', session.id);

  // ── Jackpot contribution ──
  // Pool 1/3 of spread fee (~1¢ of 3¢ spread) into global jackpot
  const JACKPOT_SHARE = 1 / 3;
  const spreadFee = Number(trade.spread_fee) || 0;
  const jackpotContribution = spreadFee * JACKPOT_SHARE;

  if (jackpotContribution > 0) {
    // Atomic increment of global pool
    await supabase.rpc('increment_jackpot_pool', { contribution: jackpotContribution });

    // Track session-level contribution
    await supabase
      .from('ep_bot_sessions')
      .update({
        jackpot_contributed: Number(session.jackpot_contributed || 0) + jackpotContribution,
      })
      .eq('id', session.id);
  }

  return NextResponse.json({
    outcome,
    pnl,
    currentBalance: newBalance,
    betsRemaining: session.bets_remaining,
    wins: newWins,
    losses: newLosses,
    totalPnl: newPnl,
    sessionEnded,
    jackpotContribution: jackpotContribution || 0,
  });
}
