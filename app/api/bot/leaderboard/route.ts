import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/bot/leaderboard
 * Returns ranked bot sessions (auto + arcade) by ROI%, win rate, or P&L.
 *
 * Query params:
 *   period: 'all' | 'week' | 'today'  (default: 'all')
 *   mode:   'all' | 'auto' | 'arcade' (default: 'all')
 *   sort:   'roi' | 'winrate' | 'pnl' (default: 'roi')
 *   limit:  number                     (default: 50, max: 100)
 *   wallet: 0x...                      (optional — returns current user's best session)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all';
    const modeFilter = searchParams.get('mode') || 'all';
    const sort = searchParams.get('sort') || 'roi';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50') || 50, 100);
    const wallet = searchParams.get('wallet')?.toLowerCase();

    const supabase = getSupabase();

    // Build query — completed sessions with at least 1 trade
    let query = supabase
      .from('ep_bot_sessions')
      .select('id, wallet_address, plan, mode, market, bankroll_usdc, starting_balance, current_balance, total_pnl, total_trades, wins, losses, started_at, stopped_at')
      .in('status', ['stopped', 'expired'])
      .gt('total_trades', 0);

    // Period filter
    if (period === 'today') {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      query = query.gte('started_at', todayStart.toISOString());
    } else if (period === 'week') {
      const weekAgo = new Date(Date.now() - 7 * 86400 * 1000);
      query = query.gte('started_at', weekAgo.toISOString());
    }

    // Mode filter
    if (modeFilter === 'auto') {
      query = query.eq('mode', 'auto');
    } else if (modeFilter === 'arcade') {
      query = query.eq('mode', 'arcade');
    }

    const { data: sessions, error } = await query.limit(200); // fetch extra to sort client-side

    if (error) throw error;

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        leaderboard: [],
        totalSessions: 0,
        avgRoi: 0,
        bestRoi: 0,
        currentUserBest: null,
      });
    }

    // Compute stats for each session
    const ranked = sessions.map((s: any) => {
      const bankroll = Number(s.bankroll_usdc) || Number(s.starting_balance) || 1;
      const pnl = Number(s.total_pnl) || 0;
      const roi = (pnl / bankroll) * 100;
      const winRate = s.total_trades > 0 ? (s.wins / s.total_trades) * 100 : 0;

      return {
        id: s.id,
        wallet: s.wallet_address,
        walletShort: `${s.wallet_address.slice(0, 6)}...${s.wallet_address.slice(-4)}`,
        mode: s.mode || 'auto',
        market: s.market,
        bankroll,
        pnl,
        roi,
        winRate,
        wins: s.wins || 0,
        losses: s.losses || 0,
        trades: s.total_trades || 0,
        startedAt: s.started_at,
      };
    });

    // Sort
    if (sort === 'roi') {
      ranked.sort((a: any, b: any) => b.roi - a.roi);
    } else if (sort === 'winrate') {
      ranked.sort((a: any, b: any) => b.winRate - a.winRate || b.roi - a.roi);
    } else if (sort === 'pnl') {
      ranked.sort((a: any, b: any) => b.pnl - a.pnl);
    }

    // Take top N
    const leaderboard = ranked.slice(0, limit).map((s: any, i: number) => ({
      rank: i + 1,
      ...s,
    }));

    // Aggregate stats
    const totalSessions = ranked.length;
    const avgRoi = ranked.reduce((sum: number, s: any) => sum + s.roi, 0) / totalSessions;
    const bestRoi = ranked.length > 0 ? ranked[0].roi : 0;

    // Current user's best session
    let currentUserBest = null;
    if (wallet) {
      const userSessions = ranked.filter((s: any) => s.wallet === wallet);
      if (userSessions.length > 0) {
        currentUserBest = {
          ...userSessions[0],
          rank: ranked.findIndex((s: any) => s.id === userSessions[0].id) + 1,
          totalSessions: userSessions.length,
        };
      }
    }

    return NextResponse.json({
      leaderboard,
      totalSessions,
      avgRoi: Math.round(avgRoi * 10) / 10,
      bestRoi: Math.round(bestRoi * 10) / 10,
      currentUserBest,
    });
  } catch (err: any) {
    console.error('Leaderboard error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
