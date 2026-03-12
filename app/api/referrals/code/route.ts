import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Alphabet without ambiguous chars (O, 0, I, l)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `EP-${code}`;
}

/**
 * GET /api/referrals/code?wallet=0x...
 * Returns the user's referral code, generating one if needed.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet')?.toLowerCase();

    if (!wallet) {
      return NextResponse.json({ error: 'wallet required' }, { status: 400 });
    }

    const sb = getSupabase();

    // Check if user already has a code
    const { data: user, error: fetchErr } = await sb
      .from('ep_users')
      .select('referral_code')
      .eq('wallet_address', wallet)
      .single();

    if (fetchErr) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.referral_code) {
      return NextResponse.json({ code: user.referral_code });
    }

    // Generate unique code with retry
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const { error: updateErr } = await sb
        .from('ep_users')
        .update({ referral_code: code })
        .eq('wallet_address', wallet);

      if (!updateErr) {
        return NextResponse.json({ code });
      }

      // Only retry on unique constraint violations
      if (!updateErr.message?.includes('unique') && !updateErr.message?.includes('duplicate')) {
        throw updateErr;
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate unique code' },
      { status: 500 }
    );
  } catch (err: any) {
    console.error('Referral code error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
