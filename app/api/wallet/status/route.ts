import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/wallet/status?address=0x...
 * Returns whether a wallet has stored CLOB credentials.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address')?.toLowerCase();

    if (!address) {
      return NextResponse.json(
        { error: 'Missing address param' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('ep_users')
      .select('clob_api_key, trade_count, encrypted_private_key, copytrade_wallet')
      .eq('wallet_address', address)
      .single();

    if (error || !data) {
      return NextResponse.json({
        connected: false,
        hasCredentials: false,
        hasAutoTrading: false,
        tradeCount: 0,
        copytradeWallet: null,
      });
    }

    return NextResponse.json({
      connected: true,
      hasCredentials: !!data.clob_api_key,
      hasAutoTrading: !!data.encrypted_private_key,
      tradeCount: data.trade_count || 0,
      copytradeWallet: data.copytrade_wallet || null,
    });
  } catch (err: any) {
    console.error('Wallet status error:', err);
    return NextResponse.json(
      { error: err.message || 'Status check failed' },
      { status: 500 }
    );
  }
}
