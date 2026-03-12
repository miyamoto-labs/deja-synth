import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';
import { decrypt } from '@/app/lib/crypto';

export const dynamic = 'force-dynamic';

/**
 * POST /api/wallet/export-copytrade-key
 * Returns the decrypted private key for the user's copytrade wallet.
 * The user must provide their auth wallet address to prove ownership.
 *
 * Body: { walletAddress: "0x..." } (auth wallet)
 * Returns: { privateKey: "0x..." }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { walletAddress } = body;

    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    const authWallet = walletAddress.toLowerCase();
    const supabase = getSupabase();

    // Look up the auth user and their copytrade wallet
    const { data: authUser } = await supabase
      .from('ep_users')
      .select('copytrade_wallet')
      .eq('wallet_address', authWallet)
      .single();

    if (!authUser?.copytrade_wallet) {
      return NextResponse.json(
        { error: 'No copy-trade wallet found for this account.' },
        { status: 404 }
      );
    }

    // Fetch the copytrade wallet's encrypted private key
    const { data: ctWallet } = await supabase
      .from('ep_users')
      .select('encrypted_private_key')
      .eq('wallet_address', authUser.copytrade_wallet)
      .single();

    if (!ctWallet?.encrypted_private_key) {
      return NextResponse.json(
        { error: 'Private key not found for copy-trade wallet.' },
        { status: 404 }
      );
    }

    const privateKey = decrypt(ctWallet.encrypted_private_key);

    return NextResponse.json({ privateKey });
  } catch (err: any) {
    console.error('Export copytrade key error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to export private key' },
      { status: 500 }
    );
  }
}
