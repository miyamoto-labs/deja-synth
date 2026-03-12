import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/bot/jackpot/award
 * Awards the current jackpot pool to the top ROI arcade session of the week.
 * Protected by CRON_SECRET bearer token.
 * Call weekly via cron or manually.
 */
export async function POST(request: Request) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabase();

    // Fetch current pool
    const { data: pool, error: poolErr } = await supabase
      .from('ep_jackpot_pool')
      .select('*')
      .eq('id', 1)
      .single();

    if (poolErr || !pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 500 });
    }

    const awardAmount = Number(pool.current_amount);
    if (awardAmount <= 0) {
      return NextResponse.json({ message: 'No jackpot to award', amount: 0 });
    }

    const weekStart = pool.week_start;
    const now = new Date().toISOString();

    // Find top ROI arcade session this week (min 3 trades to qualify)
    const { data: sessions } = await supabase
      .from('ep_bot_sessions')
      .select('id, wallet_address, total_pnl, bankroll_usdc, starting_balance, total_trades, wins, losses')
      .in('status', ['stopped', 'expired'])
      .eq('mode', 'arcade')
      .gt('total_trades', 2)
      .gte('started_at', weekStart);

    if (!sessions || sessions.length === 0) {
      // No qualifying sessions — roll over
      await supabase
        .from('ep_jackpot_pool')
        .update({ week_start: now, updated_at: now })
        .eq('id', 1);

      return NextResponse.json({
        message: 'No qualifying sessions. Jackpot rolls over.',
        amount: awardAmount,
        rolled: true,
      });
    }

    // Rank by ROI
    const ranked = sessions
      .map((s: any) => {
        const bankroll = Number(s.bankroll_usdc) || Number(s.starting_balance) || 1;
        const roi = (Number(s.total_pnl) / bankroll) * 100;
        return { ...s, roi };
      })
      .sort((a: any, b: any) => b.roi - a.roi);

    const winner = ranked[0];

    // Record the winner
    await supabase.from('ep_jackpot_winners').insert({
      session_id: winner.id,
      wallet_address: winner.wallet_address,
      amount: awardAmount,
      session_roi: winner.roi,
      session_trades: winner.total_trades,
      week_start: weekStart,
      week_end: now,
    });

    // Reset pool for next week
    await supabase
      .from('ep_jackpot_pool')
      .update({
        current_amount: 0,
        total_awarded: Number(pool.total_awarded) + awardAmount,
        last_awarded_at: now,
        week_start: now,
        updated_at: now,
      })
      .eq('id', 1);

    return NextResponse.json({
      message: 'Jackpot awarded!',
      winner: {
        wallet: winner.wallet_address,
        walletShort: `${winner.wallet_address.slice(0, 6)}...${winner.wallet_address.slice(-4)}`,
        amount: awardAmount,
        roi: Math.round(winner.roi * 10) / 10,
        sessionId: winner.id,
      },
    });
  } catch (err: any) {
    console.error('Jackpot award error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to award jackpot' },
      { status: 500 }
    );
  }
}
