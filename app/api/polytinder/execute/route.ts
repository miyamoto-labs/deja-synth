import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';
import { createServerClobClient, getBuilderConfig } from '@/app/lib/server-signer';

export const dynamic = 'force-dynamic';
export const preferredRegion = 'hnd1';

interface QueuedBet {
  tokenId: string;
  price: number;
  amount: number;
  direction: string;
  source?: string;
  sourceId?: string;
  question?: string;
}

/**
 * POST /api/polytinder/execute
 * Batch-executes queued bets from PolyTinder swipes.
 * Uses server-side signing (no MetaMask popup needed).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { walletAddress, bets } = body as { walletAddress: string; bets: QueuedBet[] };

    if (!walletAddress) {
      return NextResponse.json({ error: 'Missing walletAddress' }, { status: 400 });
    }

    if (!bets || !Array.isArray(bets) || bets.length === 0) {
      return NextResponse.json({ error: 'No bets to execute' }, { status: 400 });
    }

    if (bets.length > 20) {
      return NextResponse.json({ error: 'Maximum 20 bets per batch' }, { status: 400 });
    }

    const address = walletAddress.toLowerCase();
    const supabase = getSupabase();

    // 1. Fetch user credentials + encrypted private key
    const { data: user, error: userError } = await supabase
      .from('ep_users')
      .select('clob_api_key, clob_api_secret, clob_api_passphrase, encrypted_private_key, trade_count')
      .eq('wallet_address', address)
      .single();

    if (userError || !user || !user.clob_api_key) {
      return NextResponse.json(
        { error: 'Wallet not connected. Please connect your wallet first.' },
        { status: 401 }
      );
    }

    if (!user.encrypted_private_key) {
      // No private key stored — tell frontend to use client-side signing
      return NextResponse.json(
        { error: 'client_sign_required', requiresClientSign: true },
        { status: 403 }
      );
    }

    // 2. Create CLOB client once (reuse for all bets)
    const builderConfig = await getBuilderConfig();
    const clobClient = await createServerClobClient(
      user.encrypted_private_key,
      user.clob_api_key,
      user.clob_api_secret,
      user.clob_api_passphrase,
      builderConfig,
    );

    // 3. Execute each bet
    const results: Array<{
      index: number;
      success: boolean;
      orderID?: string;
      message?: string;
      error?: string;
      question?: string;
      direction?: string;
      amount?: number;
    }> = [];

    for (let i = 0; i < bets.length; i++) {
      const bet = bets[i];

      try {
        // Validate individual bet
        if (!bet.tokenId || !bet.price || !bet.amount) {
          results.push({ index: i, success: false, error: 'Missing required fields', question: bet.question });
          continue;
        }

        if (bet.amount < 1 || bet.amount > 1000) {
          results.push({ index: i, success: false, error: 'Amount must be $1-$1000', question: bet.question });
          continue;
        }

        const size = bet.amount / bet.price;

        const order = await clobClient.createAndPostOrder({
          tokenID: bet.tokenId,
          side: 'BUY' as any,
          size,
          price: bet.price,
        });

        const orderId = typeof order === 'object'
          ? (order as any).id || (order as any).orderID || JSON.stringify(order)
          : String(order);

        // Log trade
        await supabase.from('ep_user_trades').insert({
          user_wallet: address,
          token_id: bet.tokenId,
          side: 'BUY',
          direction: bet.direction || 'YES',
          amount: bet.amount,
          price: bet.price,
          shares: size,
          order_id: orderId,
          source: 'polytinder',
          source_id: bet.sourceId || null,
        });

        results.push({
          index: i,
          success: true,
          orderID: orderId,
          message: `${bet.direction} $${bet.amount} at ${(bet.price * 100).toFixed(0)}¢`,
          question: bet.question,
          direction: bet.direction,
          amount: bet.amount,
        });
      } catch (err: any) {
        console.error(`PolyTinder bet ${i} error:`, err.message);
        results.push({
          index: i,
          success: false,
          error: err.message || 'Trade failed',
          question: bet.question,
          direction: bet.direction,
          amount: bet.amount,
        });
      }
    }

    // 4. Update trade count
    const successCount = results.filter((r) => r.success).length;
    if (successCount > 0) {
      try {
        await supabase
          .from('ep_users')
          .update({ trade_count: (user.trade_count || 0) + successCount })
          .eq('wallet_address', address);
      } catch {
        // Non-critical
      }
    }

    const totalAmount = results
      .filter((r) => r.success)
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    return NextResponse.json({
      success: successCount > 0,
      executed: successCount,
      failed: results.length - successCount,
      total: results.length,
      totalAmount,
      results,
    });
  } catch (err: any) {
    console.error('PolyTinder batch execute error:', err);

    const msg = err.message || 'Batch execution failed';
    const isAuthError = msg.includes('401') || msg.includes('auth') || msg.includes('credential');

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
