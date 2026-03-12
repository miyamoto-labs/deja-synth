import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';
import { createServerClobClient, getBuilderConfig } from '@/app/lib/server-signer';

export const dynamic = 'force-dynamic';
export const preferredRegion = 'hnd1';

// Maximum price slippage before skipping (10 cents)
const MAX_SLIPPAGE = 0.10;

interface PickPayload {
  id: string;
  market_id: string;
  direction: string;      // 'YES' | 'NO'
  conviction_score: number;
  entry_price: number;
  category?: string;
}

/**
 * POST /api/standing-orders/execute
 * Called by the superbot engine after new picks are created.
 * Executes matching standing orders for each pick.
 *
 * Headers: { x-api-key: INTERNAL_API_SECRET }
 * Body: { picks: PickPayload[] }
 */
export async function POST(request: Request) {
  try {
    // Verify internal API key
    const apiKey = request.headers.get('x-api-key');
    const expectedKey = process.env.INTERNAL_API_SECRET;
    if (!expectedKey || apiKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { picks } = await request.json() as { picks: PickPayload[] };
    if (!picks || !Array.isArray(picks) || picks.length === 0) {
      return NextResponse.json({ error: 'picks array required' }, { status: 400 });
    }

    const sb = getSupabase();
    const results: any[] = [];

    for (const pick of picks) {
      const pickResults = await executeStandingOrdersForPick(sb, pick);
      results.push({ pickId: pick.id, executions: pickResults });
    }

    // Also execute system bets (Bet Our Picks)
    const systemResults = await executeSystemBets(sb, picks);

    return NextResponse.json({
      success: true,
      processed: picks.length,
      results,
      systemBets: systemResults,
    });
  } catch (err: any) {
    console.error('Standing orders execute error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/* ── Execute standing orders for a single pick ──────────────── */
async function executeStandingOrdersForPick(
  sb: ReturnType<typeof getSupabase>,
  pick: PickPayload,
): Promise<any[]> {
  const results: any[] = [];

  // 1. Find all matching active standing orders
  let query = sb
    .from('ep_standing_orders')
    .select('*')
    .eq('active', true)
    .lte('min_conviction', pick.conviction_score)
    .gte('max_conviction', pick.conviction_score);

  const { data: matchingOrders, error: queryErr } = await query;
  if (queryErr || !matchingOrders || matchingOrders.length === 0) return results;

  // Filter by direction and category in JS (Supabase doesn't handle NULL-as-wildcard well)
  const filteredOrders = matchingOrders.filter((order: any) => {
    // Direction filter
    if (order.direction_filter && order.direction_filter !== pick.direction) return false;
    // Category filter
    if (order.category_filter && pick.category && !order.category_filter.includes(pick.category)) return false;
    // Pause check
    if (order.paused_until && new Date(order.paused_until) > new Date()) return false;
    return true;
  });

  // 2. Get current market price for slippage check
  const { data: market } = await sb
    .from('ep_markets_raw')
    .select('yes_price, no_price, yes_token, no_token')
    .eq('market_id', pick.market_id)
    .single();

  if (!market) {
    console.warn(`Market not found for pick ${pick.id}: ${pick.market_id}`);
    return results;
  }

  const currentPrice = pick.direction === 'YES' ? market.yes_price : market.no_price;
  const tokenId = pick.direction === 'YES' ? market.yes_token : market.no_token;

  // Check slippage
  if (Math.abs(currentPrice - pick.entry_price) > MAX_SLIPPAGE) {
    console.log(`Skipping pick ${pick.id} due to price slippage: entry=${pick.entry_price}, current=${currentPrice}`);
    // Log skipped for all matching orders
    for (const order of filteredOrders) {
      await logExecution(sb, {
        standingOrderId: order.id,
        pickId: pick.id,
        userWallet: order.user_wallet,
        amount: order.amount,
        price: currentPrice,
        direction: pick.direction,
        tokenId,
        status: 'skipped',
        errorMessage: `Price slippage: entry=${pick.entry_price}, current=${currentPrice}`,
      });
      results.push({ orderId: order.id, status: 'skipped', reason: 'price_slippage' });
    }
    return results;
  }

  // 3. Process each matching order sequentially (per user to avoid nonce issues)
  const byUser = new Map<string, any[]>();
  for (const order of filteredOrders) {
    const existing = byUser.get(order.user_wallet) || [];
    existing.push(order);
    byUser.set(order.user_wallet, existing);
  }

  const userEntries = Array.from(byUser.entries());
  for (const [userWallet, userOrders] of userEntries) {
    for (const order of userOrders) {
      const result = await executeSingleOrder(sb, order, pick, tokenId, currentPrice);
      results.push(result);
    }
  }

  return results;
}

/* ── Execute a single standing order for a single pick ──────── */
async function executeSingleOrder(
  sb: ReturnType<typeof getSupabase>,
  order: any,
  pick: PickPayload,
  tokenId: string,
  currentPrice: number,
): Promise<any> {
  const { id: orderId, user_wallet, amount, daily_limit, total_limit } = order;

  try {
    // Check daily limit
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const { count: todayCount } = await sb
      .from('ep_standing_order_executions')
      .select('id', { count: 'exact', head: true })
      .eq('standing_order_id', orderId)
      .eq('status', 'executed')
      .gte('created_at', todayStart.toISOString());

    if ((todayCount || 0) >= daily_limit) {
      await logExecution(sb, {
        standingOrderId: orderId,
        pickId: pick.id,
        userWallet: user_wallet,
        amount,
        price: currentPrice,
        direction: pick.direction,
        tokenId,
        status: 'skipped',
        errorMessage: `Daily limit reached (${todayCount}/${daily_limit})`,
      });
      return { orderId, status: 'skipped', reason: 'daily_limit' };
    }

    // Check total limit
    if (total_limit !== null) {
      const { count: totalCount } = await sb
        .from('ep_standing_order_executions')
        .select('id', { count: 'exact', head: true })
        .eq('standing_order_id', orderId)
        .eq('status', 'executed');

      if ((totalCount || 0) >= total_limit) {
        // Auto-deactivate when lifetime limit reached
        await sb.from('ep_standing_orders').update({ active: false }).eq('id', orderId);
        await logExecution(sb, {
          standingOrderId: orderId,
          pickId: pick.id,
          userWallet: user_wallet,
          amount,
          price: currentPrice,
          direction: pick.direction,
          tokenId,
          status: 'skipped',
          errorMessage: `Total limit reached (${totalCount}/${total_limit}). Order deactivated.`,
        });
        return { orderId, status: 'skipped', reason: 'total_limit' };
      }
    }

    // Fetch user's CLOB credentials + encrypted private key
    const { data: user, error: userErr } = await sb
      .from('ep_users')
      .select('wallet_address, eoa_address, clob_api_key, clob_api_secret, clob_api_passphrase, encrypted_private_key')
      .eq('wallet_address', user_wallet)
      .single();

    if (userErr || !user || !user.clob_api_key) {
      await logExecution(sb, {
        standingOrderId: orderId,
        pickId: pick.id,
        userWallet: user_wallet,
        amount,
        price: currentPrice,
        direction: pick.direction,
        tokenId,
        status: 'failed',
        errorMessage: 'No CLOB credentials found',
      });
      await sb.from('ep_standing_orders').update({
        paused_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        pause_reason: 'No CLOB credentials. Please reconnect your wallet.',
      }).eq('id', orderId);
      return { orderId, status: 'failed', reason: 'no_credentials' };
    }

    if (!user.encrypted_private_key) {
      await logExecution(sb, {
        standingOrderId: orderId,
        pickId: pick.id,
        userWallet: user_wallet,
        amount,
        price: currentPrice,
        direction: pick.direction,
        tokenId,
        status: 'skipped',
        errorMessage: 'Auto-trading not enabled. User needs to add private key.',
      });
      return { orderId, status: 'skipped', reason: 'no_private_key' };
    }

    // Create CLOB client with server-side signer + builder attribution
    // For Safe wallet users: EOA key signs, but Safe is the funder (signatureType=2)
    const builderConfig = await getBuilderConfig();
    const safeAddr = (user.eoa_address && user.wallet_address !== user.eoa_address)
      ? user.wallet_address
      : undefined;
    const clobClient = await createServerClobClient(
      user.encrypted_private_key,
      user.clob_api_key,
      user.clob_api_secret,
      user.clob_api_passphrase,
      builderConfig,
      safeAddr,
    );

    // Place order
    const size = amount / currentPrice;
    const orderResult = await clobClient.createAndPostOrder({
      tokenID: tokenId,
      side: 'BUY' as any,
      size,
      price: currentPrice,
    });

    const clobOrderId = typeof orderResult === 'object'
      ? (orderResult as any).id || (orderResult as any).orderID || JSON.stringify(orderResult)
      : String(orderResult);

    // Log successful execution
    await logExecution(sb, {
      standingOrderId: orderId,
      pickId: pick.id,
      userWallet: user_wallet,
      amount,
      price: currentPrice,
      direction: pick.direction,
      tokenId,
      orderId: clobOrderId,
      status: 'executed',
    });

    // Log to ep_user_trades
    await sb.from('ep_user_trades').insert({
      user_wallet: user_wallet,
      token_id: tokenId,
      side: 'BUY',
      direction: pick.direction,
      amount,
      price: currentPrice,
      shares: size,
      order_id: clobOrderId,
      source: 'standing-order',
      source_id: orderId,
    });

    // Award points
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/points/award`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: user_wallet,
          points: 15,
          reason: 'trade',
          metadata: { source: 'standing-order', pickId: pick.id, orderId: clobOrderId },
        }),
      });
    } catch {
      // Non-critical
    }

    return { orderId, status: 'executed', clobOrderId };
  } catch (err: any) {
    console.error(`Standing order ${orderId} execution error:`, err);

    const msg = err.message || 'Unknown error';
    const isAuth = msg.includes('401') || msg.includes('auth') || msg.includes('credential');

    await logExecution(sb, {
      standingOrderId: orderId,
      pickId: pick.id,
      userWallet: user_wallet,
      amount: order.amount,
      price: currentPrice,
      direction: pick.direction,
      tokenId,
      status: 'failed',
      errorMessage: msg,
    });

    // Pause on auth errors
    if (isAuth) {
      await sb.from('ep_standing_orders').update({
        paused_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        pause_reason: 'Credentials expired. Please reconnect your wallet.',
      }).eq('id', orderId);
    }

    return { orderId, status: 'failed', reason: isAuth ? 'auth_error' : 'execution_error', error: msg };
  }
}

/* ── Log an execution record ────────────────────────────────── */
async function logExecution(
  sb: ReturnType<typeof getSupabase>,
  data: {
    standingOrderId: string;
    pickId: string;
    userWallet: string;
    amount: number;
    price: number;
    direction: string;
    tokenId: string;
    orderId?: string;
    status: string;
    errorMessage?: string;
  },
) {
  try {
    await sb.from('ep_standing_order_executions').insert({
      standing_order_id: data.standingOrderId,
      pick_id: data.pickId,
      user_wallet: data.userWallet,
      amount: data.amount,
      price: data.price,
      direction: data.direction,
      token_id: data.tokenId,
      order_id: data.orderId || null,
      status: data.status,
      error_message: data.errorMessage || null,
    });
  } catch (err) {
    // If it's a unique constraint violation, that's expected (dedup)
    console.warn('Execution log insert error (may be dedup):', err);
  }
}

/* ── System Bets: EasyPoly bets its own high-conviction picks ── */
async function executeSystemBets(
  sb: ReturnType<typeof getSupabase>,
  picks: PickPayload[],
): Promise<any[]> {
  const systemWallet = process.env.EASYPOLY_SYSTEM_WALLET;
  const systemApiKey = process.env.EASYPOLY_SYSTEM_API_KEY;
  const systemApiSecret = process.env.EASYPOLY_SYSTEM_API_SECRET;
  const systemApiPassphrase = process.env.EASYPOLY_SYSTEM_API_PASSPHRASE;
  const systemPrivateKey = process.env.EASYPOLY_SYSTEM_PRIVATE_KEY;

  if (!systemWallet || !systemApiKey || !systemApiSecret || !systemApiPassphrase || !systemPrivateKey) {
    return []; // System wallet not configured
  }

  const results: any[] = [];

  // Check today's system bet count (max 3/day)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { count: todaySystemBets } = await sb
    .from('ep_system_trades')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', todayStart.toISOString());

  let remainingBets = 3 - (todaySystemBets || 0);
  if (remainingBets <= 0) return results;

  // Filter high-conviction picks (>= 90)
  const highConvictionPicks = picks
    .filter(p => p.conviction_score >= 90)
    .sort((a, b) => b.conviction_score - a.conviction_score);

  for (const pick of highConvictionPicks) {
    if (remainingBets <= 0) break;

    // Check if already bet on this pick
    const { count: existing } = await sb
      .from('ep_system_trades')
      .select('id', { count: 'exact', head: true })
      .eq('pick_id', pick.id);

    if (existing && existing > 0) continue;

    // Determine amount based on conviction
    let amount: number;
    if (pick.conviction_score >= 98) amount = 25;
    else if (pick.conviction_score >= 95) amount = 15;
    else amount = 5;

    // Get market data
    const { data: market } = await sb
      .from('ep_markets_raw')
      .select('yes_price, no_price, yes_token, no_token')
      .eq('market_id', pick.market_id)
      .single();

    if (!market) continue;

    const price = pick.direction === 'YES' ? market.yes_price : market.no_price;
    const tokenId = pick.direction === 'YES' ? market.yes_token : market.no_token;

    try {
      const { Wallet } = await import('ethers');
      const { ClobClient } = await import('@polymarket/clob-client');

      const systemSigner = new Wallet(systemPrivateKey);
      const signerShim = new Proxy(systemSigner, {
        get(target, prop, receiver) {
          if (prop === '_signTypedData') {
            return target.signTypedData.bind(target);
          }
          return Reflect.get(target, prop, receiver);
        },
      });

      const builderConfig = await getBuilderConfig();

      const clobClient = new ClobClient(
        'https://clob.polymarket.com',
        137,
        signerShim as any,
        { key: systemApiKey, secret: systemApiSecret, passphrase: systemApiPassphrase },
        undefined, undefined, undefined, undefined,
        builderConfig,
      );

      const size = amount / price;
      const orderResult = await clobClient.createAndPostOrder({
        tokenID: tokenId,
        side: 'BUY' as any,
        size,
        price,
      });

      const clobOrderId = typeof orderResult === 'object'
        ? (orderResult as any).id || (orderResult as any).orderID || JSON.stringify(orderResult)
        : String(orderResult);

      // Log system trade
      await sb.from('ep_system_trades').insert({
        pick_id: pick.id,
        market_id: pick.market_id,
        direction: pick.direction,
        amount,
        price,
        shares: size,
        order_id: clobOrderId,
        status: 'active',
      });

      results.push({ pickId: pick.id, amount, status: 'executed' });
      remainingBets--;
    } catch (err: any) {
      console.error(`System bet error for pick ${pick.id}:`, err);
      results.push({ pickId: pick.id, status: 'failed', error: err.message });
    }
  }

  return results;
}
