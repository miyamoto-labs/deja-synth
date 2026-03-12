import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/referrals/stats?wallet=0x...
 * Returns referral stats + anonymized list of referred users.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet')?.toLowerCase();

    if (!wallet) {
      return NextResponse.json({ error: 'wallet required' }, { status: 400 });
    }

    const sb = getSupabase();

    const { data: referrals, error } = await sb
      .from('ep_referrals')
      .select('*')
      .eq('referrer_wallet', wallet)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const list = referrals || [];

    const anonymized = list.map((r) => ({
      id: r.id,
      wallet: r.referred_wallet
        ? `${r.referred_wallet.slice(0, 6)}...${r.referred_wallet.slice(-4)}`
        : 'Unknown',
      status: r.status,
      joinedAt: r.created_at,
    }));

    return NextResponse.json({
      stats: {
        totalReferrals: list.length,
        activeReferrals: list.filter((r) => r.status === 'active').length,
        connectedReferrals: list.length,
      },
      referrals: anonymized,
    });
  } catch (err: any) {
    console.error('Referral stats error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
