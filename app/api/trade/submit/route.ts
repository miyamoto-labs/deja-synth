import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';
import { decrypt } from '@/app/lib/crypto';
import { submitOrderToCLOB } from '@/app/lib/clob-proxy';

export const dynamic = 'force-dynamic';

/**
 * POST /api/trade/submit
 *
 * Receives a pre-signed order (signed client-side via MetaMask) and
 * submits it to the Polymarket CLOB with builder attribution headers.
 *
 * The order's EIP-712 signature was created client-side where the
 * private key lives. This server only adds HMAC L2 auth headers
 * and builder attribution before forwarding to the CLOB.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      signedOrder,
      walletAddress,
      direction,
      amount,
      price,
      source,
      sourceId,
      marketSlug,
      orderType = 'GTC',
    } = body;

    // ── Validate ────────────────────────────────────
    if (!signedOrder || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: signedOrder, walletAddress' },
        { status: 400 }
      );
    }

    if (!signedOrder.signature || !signedOrder.tokenId) {
      return NextResponse.json(
        { error: 'Invalid signed order — missing signature or tokenId' },
        { status: 400 }
      );
    }

    const address = walletAddress.toLowerCase();
    const supabase = getSupabase();

    // ── 1. Fetch user's API credentials ─────────────
    const { data: user, error: userError } = await supabase
      .from('ep_users')
      .select('clob_api_key, clob_api_secret, clob_api_passphrase')
      .eq('wallet_address', address)
      .single();

    if (userError || !user || !user.clob_api_key) {
      return NextResponse.json(
        { error: 'Wallet not connected. Please connect your wallet first.' },
        { status: 401 }
      );
    }

    const apiKey = decrypt(user.clob_api_key);
    const apiSecret = decrypt(user.clob_api_secret);
    const apiPassphrase = decrypt(user.clob_api_passphrase);

    // ── 2. Submit to CLOB (via proxy if CLOB_PROXY_URL is set) ──
    const clobResult = await submitOrderToCLOB({
      signedOrder,
      apiKey,
      apiSecret,
      apiPassphrase,
      walletAddress: address,
      orderType,
    });

    if (!clobResult.ok) {
      console.error('CLOB order submission error:', clobResult.status, clobResult.data);
      return NextResponse.json(
        {
          success: false,
          error: clobResult.data.error || clobResult.data.message || `CLOB returned ${clobResult.status}`,
        },
        { status: clobResult.status >= 500 ? 502 : clobResult.status }
      );
    }

    const clobData = clobResult.data;

    // ── 6. Log the trade ────────────────────────────
    const orderId =
      clobData.orderID ||
      clobData.id ||
      clobData.order_id ||
      JSON.stringify(clobData);

    const shares = amount && price ? amount / price : 0;

    await supabase.from('ep_user_trades').insert({
      user_wallet: address,
      token_id: signedOrder.tokenId,
      side: signedOrder.side === 0 ? 'BUY' : 'SELL',
      direction: direction || 'YES',
      amount: amount || 0,
      price: price || 0,
      shares,
      order_id: typeof orderId === 'string' ? orderId : JSON.stringify(orderId),
      source: source || null,
      source_id: sourceId || null,
      market_slug: marketSlug || null,
    });

    // ── 7. Increment trade count ────────────────────
    try {
      const { data: userData } = await supabase
        .from('ep_users')
        .select('trade_count')
        .eq('wallet_address', address)
        .single();

      await supabase
        .from('ep_users')
        .update({ trade_count: ((userData as any)?.trade_count || 0) + 1 })
        .eq('wallet_address', address);
    } catch {
      // Non-critical — trade was already placed
    }

    return NextResponse.json({
      success: true,
      orderID: orderId,
      message: `Order placed: ${signedOrder.side === 0 ? 'BUY' : 'SELL'} $${amount || '?'} at ${price ? (price * 100).toFixed(0) + '¢' : '?'}`,
    });
  } catch (err: any) {
    console.error('Trade submit error:', err);

    const msg = err.message || 'Trade failed';
    const isAuthError =
      msg.includes('401') || msg.includes('auth') || msg.includes('credential');

    return NextResponse.json(
      {
        success: false,
        error: isAuthError
          ? 'Credentials expired. Please reconnect your wallet.'
          : msg,
      },
      { status: isAuthError ? 401 : 500 }
    );
  }
}

