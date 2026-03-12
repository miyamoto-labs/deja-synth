import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';
import { decrypt } from '@/app/lib/crypto';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const CLOB_HOST = 'https://clob.polymarket.com';

/**
 * GET /api/wallet/balance?wallet=0x...
 * Returns the user's USDC balance on Polymarket.
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

    // Fetch user's encrypted credentials
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

    const apiKey = decrypt(user.clob_api_key);
    const apiSecret = decrypt(user.clob_api_secret);
    const apiPassphrase = decrypt(user.clob_api_passphrase);

    // Build HMAC auth headers for the balance endpoint
    const timestamp = Math.floor(Date.now() / 1000);
    const method = 'GET';
    const requestPath = '/balance';

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

    const res = await fetch(`${CLOB_HOST}${requestPath}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        POLY_ADDRESS: walletAddress,
        POLY_SIGNATURE: sig,
        POLY_TIMESTAMP: `${timestamp}`,
        POLY_API_KEY: apiKey,
        POLY_PASSPHRASE: apiPassphrase,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error('Balance fetch error:', res.status, errData);
      return NextResponse.json(
        { error: `Failed to fetch balance (${res.status})` },
        { status: 502 }
      );
    }

    const data = await res.json();

    // Polymarket returns balance in USDC micro-units (6 decimals)
    // The exact format may vary — handle both number and string
    const rawBalance = data?.balance ?? data?.cash_balance ?? data?.usdc ?? 0;
    const balance = typeof rawBalance === 'string' ? parseFloat(rawBalance) : rawBalance;

    // CLOB always returns micro-USDC (6 decimals): 5000000 = $5.00
    const usdcBalance = balance / 1_000_000;

    return NextResponse.json({
      balance: usdcBalance,
      raw: data, // Include raw response for debugging
    });
  } catch (err: any) {
    console.error('Balance endpoint error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch balance' },
      { status: 500 }
    );
  }
}
