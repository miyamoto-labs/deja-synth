import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/trade/log
 *
 * Lightweight endpoint to record a trade that was executed client-side
 * (e.g. via Privy embedded wallet + ClobClient.createAndPostOrder).
 *
 * Since the Privy path posts directly to the CLOB without going through
 * our /api/trade/submit server route, this endpoint ensures trades still
 * get logged to ep_user_trades for portfolio tracking.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      walletAddress,
      tokenId,
      side,
      direction,
      amount,
      price,
      orderId,
      source,
      sourceId,
      marketSlug,
    } = body;

    if (!walletAddress || !tokenId) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, tokenId' },
        { status: 400 }
      );
    }

    const address = walletAddress.toLowerCase();
    const supabase = getSupabase();

    const shares = amount && price ? amount / price : 0;

    // Insert trade record
    const { error: insertError } = await supabase.from('ep_user_trades').insert({
      user_wallet: address,
      token_id: tokenId,
      side: side || 'BUY',
      direction: direction || 'YES',
      amount: amount || 0,
      price: price || 0,
      shares,
      order_id: orderId || 'unknown',
      source: source || null,
      source_id: sourceId || null,
      market_slug: marketSlug || null,
    });

    if (insertError) {
      console.error('[trade/log] Insert error:', insertError);
      // Non-fatal — the trade was already placed on-chain
    }

    // Increment trade count
    try {
      const { data: userData } = await supabase
        .from('ep_users')
        .select('trade_count')
        .eq('wallet_address', address)
        .single();

      if (userData) {
        await supabase
          .from('ep_users')
          .update({ trade_count: ((userData as any)?.trade_count || 0) + 1 })
          .eq('wallet_address', address);
      }
    } catch {
      // Non-critical
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[trade/log] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to log trade' },
      { status: 500 }
    );
  }
}
