import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

const TIER_THRESHOLDS: [number, string][] = [
  [10000, 'diamond'],
  [2000, 'gold'],
  [500, 'silver'],
  [0, 'bronze'],
];

function getTier(points: number): string {
  for (const [threshold, tier] of TIER_THRESHOLDS) {
    if (points >= threshold) return tier;
  }
  return 'bronze';
}

/**
 * POST /api/points/award
 * Body: { wallet, points, reason, metadata? }
 * Awards points to a user, updates summary + tier.
 */
export async function POST(request: Request) {
  try {
    const { wallet, points, reason, metadata } = await request.json();

    if (!wallet || !points || !reason) {
      return NextResponse.json(
        { error: 'wallet, points, and reason required' },
        { status: 400 }
      );
    }

    const address = wallet.toLowerCase();
    const sb = getSupabase();

    // Deduplicate one-time awards (signup)
    if (reason === 'signup') {
      const { data: alreadyAwarded } = await sb
        .from('ep_points_ledger')
        .select('id')
        .eq('user_wallet', address)
        .eq('reason', 'signup')
        .limit(1)
        .single();

      if (alreadyAwarded) {
        return NextResponse.json({ success: true, points: 0, deduplicated: true });
      }
    }

    // 1. Insert ledger entry
    const { error: ledgerErr } = await sb.from('ep_points_ledger').insert({
      user_wallet: address,
      points,
      reason,
      metadata: metadata || {},
    });

    if (ledgerErr) throw ledgerErr;

    // 2. Upsert points summary
    const { data: existing } = await sb
      .from('ep_user_points')
      .select('total_points, referral_count, trade_count')
      .eq('user_wallet', address)
      .single();

    if (existing) {
      const newTotal = existing.total_points + points;
      const updates: Record<string, any> = {
        total_points: newTotal,
        tier: getTier(newTotal),
        updated_at: new Date().toISOString(),
      };
      if (reason === 'referral') updates.referral_count = existing.referral_count + 1;
      if (reason === 'trade') updates.trade_count = existing.trade_count + 1;

      const { error } = await sb
        .from('ep_user_points')
        .update(updates)
        .eq('user_wallet', address);

      if (error) throw error;
    } else {
      const newRow: Record<string, any> = {
        user_wallet: address,
        total_points: points,
        tier: getTier(points),
        referral_count: reason === 'referral' ? 1 : 0,
        trade_count: reason === 'trade' ? 1 : 0,
      };

      const { error } = await sb.from('ep_user_points').insert(newRow);
      if (error) throw error;
    }

    return NextResponse.json({ success: true, points });
  } catch (err: any) {
    console.error('Points award error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
