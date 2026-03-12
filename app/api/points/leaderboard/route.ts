import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/points/leaderboard?wallet=0x...&limit=50
 * Returns ranked leaderboard + current user's position.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet')?.toLowerCase();
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    const sb = getSupabase();

    // 1. Get top users by points
    const { data: leaders, error } = await sb
      .from('ep_user_points')
      .select('*')
      .order('total_points', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // 2. Anonymize wallets and add rank
    const leaderboard = (leaders || []).map((u, i) => ({
      rank: i + 1,
      wallet: `${u.user_wallet.slice(0, 6)}...${u.user_wallet.slice(-4)}`,
      walletFull: u.user_wallet,
      totalPoints: u.total_points,
      tier: u.tier,
      referralCount: u.referral_count,
      tradeCount: u.trade_count,
      isCurrentUser: wallet ? u.user_wallet === wallet : false,
    }));

    // 3. Get aggregate stats
    const { count: totalUsers } = await sb
      .from('ep_user_points')
      .select('*', { count: 'exact', head: true });

    // Get average points
    const allPoints = (leaders || []).map((u) => u.total_points);
    const avgPoints = allPoints.length
      ? Math.round(allPoints.reduce((a, b) => a + b, 0) / allPoints.length)
      : 0;
    const topScore = allPoints.length ? allPoints[0] : 0;

    // 4. Find current user's rank if not in top N
    let currentUserRank: number | null = null;
    let currentUserStats = null;

    if (wallet) {
      const found = leaderboard.find((l) => l.isCurrentUser);
      if (found) {
        currentUserRank = found.rank;
        currentUserStats = found;
      } else {
        // User exists but not in top N — calculate their rank
        const { data: userSummary } = await sb
          .from('ep_user_points')
          .select('*')
          .eq('user_wallet', wallet)
          .single();

        if (userSummary) {
          const { count } = await sb
            .from('ep_user_points')
            .select('*', { count: 'exact', head: true })
            .gt('total_points', userSummary.total_points);

          currentUserRank = (count || 0) + 1;
          currentUserStats = {
            rank: currentUserRank,
            wallet: `${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
            totalPoints: userSummary.total_points,
            tier: userSummary.tier,
            referralCount: userSummary.referral_count,
            tradeCount: userSummary.trade_count,
            isCurrentUser: true,
          };
        }
      }
    }

    return NextResponse.json({
      leaderboard,
      totalUsers: totalUsers || 0,
      avgPoints,
      topScore,
      currentUserRank,
      currentUserStats,
    });
  } catch (err: any) {
    console.error('Leaderboard error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
