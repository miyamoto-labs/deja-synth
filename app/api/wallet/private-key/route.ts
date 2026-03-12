import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';
import { encrypt } from '@/app/lib/crypto';
import { Wallet } from 'ethers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/wallet/private-key
 * Stores an encrypted private key for server-side order signing.
 * Validates the key matches the connected wallet address.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { walletAddress, privateKey } = body;

    if (!walletAddress || !privateKey) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, privateKey' },
        { status: 400 }
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    const address = walletAddress.toLowerCase();

    // Validate the private key and verify it matches the wallet
    let keyStr: string;
    try {
      keyStr = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
      const wallet = new Wallet(keyStr);
      const derivedAddress = wallet.address.toLowerCase();

      if (derivedAddress !== address) {
        return NextResponse.json(
          {
            error: `Key doesn't match your wallet. This key belongs to ${derivedAddress.slice(0, 8)}...${derivedAddress.slice(-4)}`,
          },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid private key format. Please check and try again.' },
        { status: 400 }
      );
    }

    // Encrypt and store
    const encryptedKey = encrypt(keyStr);
    const supabase = getSupabase();

    // Verify user exists — check both wallet_address (Safe) and eoa_address (EOA)
    let userRow: any = null;
    const { data: u1 } = await supabase
      .from('ep_users')
      .select('id, wallet_address')
      .eq('wallet_address', address)
      .single();
    if (u1) {
      userRow = u1;
    } else {
      const { data: u2 } = await supabase
        .from('ep_users')
        .select('id, wallet_address')
        .eq('eoa_address', address)
        .single();
      if (u2) userRow = u2;
    }

    if (!userRow) {
      return NextResponse.json(
        { error: 'Wallet not found. Please connect your wallet first.' },
        { status: 404 }
      );
    }

    // Store encrypted key on the user's record (always keyed by wallet_address/Safe)
    const { error: updateErr } = await supabase
      .from('ep_users')
      .update({ encrypted_private_key: encryptedKey })
      .eq('wallet_address', userRow.wallet_address);

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Private key storage error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to store private key' },
      { status: 500 }
    );
  }
}
