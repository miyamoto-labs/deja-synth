import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';
import { encrypt } from '@/app/lib/crypto';
import crypto from 'crypto';
import { Wallet } from 'ethers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/wallet/connect
 * Stores encrypted CLOB credentials for a wallet address.
 * Optionally stores an encrypted private key for server-side order signing.
 * Validates credentials against Polymarket CLOB before storing.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { walletAddress, eoaAddress, apiKey, apiSecret, apiPassphrase, privateKey } = body;

    // Validate
    if (!walletAddress || !apiKey || !apiSecret || !apiPassphrase) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    const address = walletAddress.toLowerCase();
    // CLOB credentials are derived from the EOA signer, not the Safe proxy.
    // Use eoaAddress for CLOB validation, fall back to walletAddress for backwards compat.
    const clobAddress = (eoaAddress && /^0x[a-fA-F0-9]{40}$/.test(eoaAddress))
      ? eoaAddress.toLowerCase()
      : address;

    // ── Validate credentials against Polymarket CLOB ──
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const method = 'GET';
      const requestPath = '/auth/api-keys';

      const message = `${timestamp}${method}${requestPath}`;
      const keyBuffer = Buffer.from(
        apiSecret.replace(/-/g, '+').replace(/_/g, '/'),
        'base64'
      );
      const sig = crypto
        .createHmac('sha256', keyBuffer)
        .update(message)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

      const validateRes = await fetch(`https://clob.polymarket.com${requestPath}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          POLY_ADDRESS: clobAddress,
          POLY_SIGNATURE: sig,
          POLY_TIMESTAMP: `${timestamp}`,
          POLY_API_KEY: apiKey,
          POLY_PASSPHRASE: apiPassphrase,
        },
      });

      if (!validateRes.ok) {
        console.error('Credential validation failed:', validateRes.status, 'clobAddress:', clobAddress);
        return NextResponse.json(
          { error: 'Credentials are invalid. Please try reconnecting your wallet.' },
          { status: 401 }
        );
      }
    } catch (validationErr) {
      // If validation network fails, still allow connection (don't block on CLOB downtime)
      console.warn('Credential validation skipped (network error):', validationErr);
    }

    // ── Validate & encrypt optional private key ──
    let encPrivateKey: string | null = null;
    if (privateKey) {
      try {
        // Validate it's a real private key and matches the wallet address
        const keyStr = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
        const wallet = new Wallet(keyStr);
        const derivedAddress = wallet.address.toLowerCase();

        if (derivedAddress !== address) {
          return NextResponse.json(
            { error: `Private key doesn't match wallet. Key derives ${derivedAddress.slice(0, 8)}..., expected ${address.slice(0, 8)}...` },
            { status: 400 }
          );
        }

        encPrivateKey = encrypt(keyStr);
      } catch (pkErr: any) {
        return NextResponse.json(
          { error: 'Invalid private key format. Please check and try again.' },
          { status: 400 }
        );
      }
    }

    // Encrypt credentials
    const encKey = encrypt(apiKey);
    const encSecret = encrypt(apiSecret);
    const encPassphrase = encrypt(apiPassphrase);

    const supabase = getSupabase();

    // Check if user exists with this wallet address
    const { data: existing } = await supabase
      .from('ep_users')
      .select('id')
      .eq('wallet_address', address)
      .single();

    // Build the fields to store
    const updateFields: Record<string, any> = {
      clob_api_key: encKey,
      clob_api_secret: encSecret,
      clob_api_passphrase: encPassphrase,
      last_connected: new Date().toISOString(),
    };

    // Store EOA address if provided (needed for Privy server-side signing)
    if (eoaAddress && /^0x[a-fA-F0-9]{40}$/.test(eoaAddress)) {
      updateFields.eoa_address = eoaAddress.toLowerCase();
    }

    // Only overwrite private key if a new one was provided
    if (encPrivateKey) {
      updateFields.encrypted_private_key = encPrivateKey;
    }

    if (existing) {
      // Update existing user's credentials
      const { error } = await supabase
        .from('ep_users')
        .update(updateFields)
        .eq('wallet_address', address);

      if (error) throw error;
    } else {
      // Create new user record
      const { error } = await supabase.from('ep_users').insert({
        wallet_address: address,
        ...updateFields,
      });

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Wallet connect error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to store credentials' },
      { status: 500 }
    );
  }
}
