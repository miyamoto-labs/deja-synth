import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/referrals/track
 * Body: { walletAddress, referralCode }
 * Tracks a referral on wallet connect. Awards points to both users.
 */
export async function POST(request: Request) {
  try {
    const { walletAddress, referralCode } = await request.json();

    if (!walletAddress || !referralCode) {
      return NextResponse.json(
        { error: 'walletAddress and referralCode required' },
        { status: 400 }
      );
    }

    const address = walletAddress.toLowerCase();
    const code = referralCode.toUpperCase();
    const sb = getSupabase();

    // 1. Find the referrer by code
    const { data: referrer } = await sb
      .from('ep_users')
      .select('wallet_address')
      .eq('referral_code', code)
      .single();

    if (!referrer) {
      return NextResponse.json({ tracked: false, reason: 'invalid_code' });
    }

    // 2. Prevent self-referral
    if (referrer.wallet_address === address) {
      return NextResponse.json({ tracked: false, reason: 'self_referral' });
    }

    // 3. Check duplicate
    const { data: existing } = await sb
      .from('ep_referrals')
      .select('id')
      .eq('referred_wallet', address)
      .single();

    if (existing) {
      return NextResponse.json({ tracked: false, reason: 'already_referred' });
    }

    // 4. Insert referral record
    const { error: insertErr } = await sb.from('ep_referrals').insert({
      referrer_wallet: referrer.wallet_address,
      referred_wallet: address,
      referral_code: code,
      status: 'connected',
    });

    if (insertErr) throw insertErr;

    // 5. Update referred user's record
    await sb
      .from('ep_users')
      .update({ referred_by: referrer.wallet_address })
      .eq('wallet_address', address);

    // 6. Award points to both users via internal API
    const baseUrl = new URL(request.url).origin;

    // 250 pts to referrer
    await fetch(`${baseUrl}/api/points/award`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: referrer.wallet_address,
        points: 250,
        reason: 'referral',
        metadata: { referred_wallet: address },
      }),
    });

    // 100 pts signup bonus to new user
    await fetch(`${baseUrl}/api/points/award`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: address,
        points: 100,
        reason: 'signup',
        metadata: { referred_by: referrer.wallet_address },
      }),
    });

    // 7. Notify referrer
    try {
      await fetch(`${baseUrl}/api/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'system',
          title: 'New referral! +250 points',
          body: `${address.slice(0, 6)}...${address.slice(-4)} joined via your invite link.`,
          wallet: referrer.wallet_address,
          telegram: false,
        }),
      });
    } catch {
      // Non-critical
    }

    return NextResponse.json({ tracked: true });
  } catch (err: any) {
    console.error('Referral track error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
