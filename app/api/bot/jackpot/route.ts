import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/bot/jackpot
 * Returns current jackpot pool state, recent winners, and optional session contribution.
 *
 * Query params:
 *   sessionId: UUID  (optional — returns specific session's contribution)
 *   wallet:    0x... (optional — for future use)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    const supabase = getSupabase();

    // Fetch current pool
    const { data: pool, error: poolErr } = await supabase
      .from('ep_jackpot_pool')
      .select('*')
      .eq('id', 1)
      .single();

    if (poolErr) throw poolErr;

    // Fetch recent winners (last 10)
    const { data: winners } = await supabase
      .from('ep_jackpot_winners')
      .select('*')
      .order('awarded_at', { ascending: false })
      .limit(10);

    // Fetch session contribution if requested
    let sessionContribution = 0;
    if (sessionId) {
      const { data: session } = await supabase
        .from('ep_bot_sessions')
        .select('jackpot_contributed')
        .eq('id', sessionId)
        .single();

      sessionContribution = Number(session?.jackpot_contributed) || 0;
    }

    // Find current week's leader (top ROI arcade session this week)
    const weekStart = pool.week_start || new Date(Date.now() - 7 * 86400 * 1000).toISOString();
    let weekLeader = null;

    const { data: weekSessions } = await supabase
      .from('ep_bot_sessions')
      .select('id, wallet_address, total_pnl, bankroll_usdc, starting_balance, total_trades, wins, losses')
      .in('status', ['stopped', 'expired'])
      .eq('mode', 'arcade')
      .gt('total_trades', 2) // min 3 trades
      .gte('started_at', weekStart)
      .limit(100);

    if (weekSessions && weekSessions.length > 0) {
      const ranked = weekSessions
        .map((s: any) => {
          const bankroll = Number(s.bankroll_usdc) || Number(s.starting_balance) || 1;
          const roi = (Number(s.total_pnl) / bankroll) * 100;
          return {
            sessionId: s.id,
            wallet: s.wallet_address,
            walletShort: `${s.wallet_address.slice(0, 6)}...${s.wallet_address.slice(-4)}`,
            roi: Math.round(roi * 10) / 10,
            trades: s.total_trades,
          };
        })
        .sort((a: any, b: any) => b.roi - a.roi);

      weekLeader = ranked[0];
    }

    return NextResponse.json({
      pool: {
        currentAmount: Number(pool.current_amount),
        totalCollected: Number(pool.total_collected),
        totalAwarded: Number(pool.total_awarded),
        totalContributions: pool.total_contributions,
        lastContributionAt: pool.last_contribution_at,
        weekStart: pool.week_start,
      },
      recentWinners: (winners || []).map((w: any) => ({
        id: w.id,
        wallet: w.wallet_address,
        walletShort: `${w.wallet_address.slice(0, 6)}...${w.wallet_address.slice(-4)}`,
        amount: Number(w.amount),
        roi: Number(w.session_roi),
        awardedAt: w.awarded_at,
      })),
      sessionContribution,
      weekLeader,
    });
  } catch (err: any) {
    console.error('Jackpot API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch jackpot data' },
      { status: 500 }
    );
  }
}
