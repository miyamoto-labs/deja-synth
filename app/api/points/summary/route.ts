import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/points/summary?wallet=0x...
 * Returns user's points summary, rank, and recent activity.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet')?.toLowerCase();

    if (!wallet) {
      return NextResponse.json({ error: 'wallet required' }, { status: 400 });
    }

    const sb = getSupabase();

    // 1. Get user's points summary
    const { data: summary } = await sb
      .from('ep_user_points')
      .select('*')
      .eq('user_wallet', wallet)
      .single();

    // 2. Calculate rank (count users with more points)
    let rank = 1;
    if (summary) {
      const { count } = await sb
        .from('ep_user_points')
        .select('*', { count: 'exact', head: true })
        .gt('total_points', summary.total_points);
      rank = (count || 0) + 1;
    }

    // 3. Get recent activity (last 20 ledger entries)
    const { data: activity } = await sb
      .from('ep_points_ledger')
      .select('*')
      .eq('user_wallet', wallet)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      summary: summary || {
        user_wallet: wallet,
        total_points: 0,
        tier: 'bronze',
        referral_count: 0,
        trade_count: 0,
      },
      rank,
      activity: activity || [],
    });
  } catch (err: any) {
    console.error('Points summary error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
