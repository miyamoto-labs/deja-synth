import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';
import { decrypt } from '@/app/lib/crypto';

export const dynamic = 'force-dynamic';

/**
 * GET /api/wallet/creds?wallet=0x...
 * Returns decrypted CLOB API credentials for the connected wallet.
 *
 * Security note: These creds were derived client-side from the user's
 * own wallet signature — they already "own" them. We're just returning
 * what they gave us so the client can construct a ClobClient for signing.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet')?.toLowerCase();

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Missing wallet query parameter' },
        { status: 400 }
      );
    }

    if (!/^0x[a-f0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { data: user, error: userError } = await supabase
      .from('ep_users')
      .select('clob_api_key, clob_api_secret, clob_api_passphrase')
      .eq('wallet_address', walletAddress)
      .single();

    if (userError || !user || !user.clob_api_key) {
      return NextResponse.json(
        { error: 'No credentials found. Please connect your wallet first.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      key: decrypt(user.clob_api_key),
      secret: decrypt(user.clob_api_secret),
      passphrase: decrypt(user.clob_api_passphrase),
    });
  } catch (err: any) {
    console.error('Wallet creds error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve credentials' },
      { status: 500 }
    );
  }
}
