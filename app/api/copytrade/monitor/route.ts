import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';
import { createServerClobClient, getBuilderConfig } from '@/app/lib/server-signer';
import { createPrivyClobClient, isPrivyServerAvailable } from '@/app/lib/privy-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/copytrade/monitor
 *
 * Position monitor for Stop Loss / Take Profit enforcement.
 * Called every 5 min by the same cron that calls /api/copytrade/process.
 *
 * For each user with SL/TP configured:
 * 1. Fetches live positions from Polymarket
 * 2. Calculates P&L vs entry price (from copytrade execution logs)
 * 3. Auto-sells if SL or TP threshold is breached
 *
 * Auth: Authorization: Bearer {CRON_SECRET}
 */
export async function GET(request: Request) {
  try {
    // ── Auth ──────────────────────────────────────────
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sb = getSupabase();
    let checked = 0;
    let triggered = 0;
    let failed = 0;
    let skipped = 0;

    const hasProxy = !!process.env.CLOB_PROXY_URL;
    if (!hasProxy) {
      return NextResponse.json({
        checked: 0, triggered: 0, failed: 0, skipped: 0,
        message: 'CLOB_PROXY_URL not set — monitor skipped',
      });
    }

    // ── 1. Fetch follows with SL or TP configured ────
    const { data: rawFollows, error: followsErr } = await sb
      .from('ep_user_follows')
      .select('id, user_wallet, trader_id, stop_loss_pct, take_profit_pct, sl_buffer_pct, active')
      .eq('active', true)
      .or('stop_loss_pct.not.is.null,take_profit_pct.not.is.null');

    if (followsErr) throw followsErr;

    const follows = (rawFollows || []).filter(
      (f: any) => f.active === true || f.active === 'true',
    );

    if (follows.length === 0) {
      return NextResponse.json({ checked: 0, triggered: 0, failed: 0, skipped: 0 });
    }

    // Group by user_wallet
    const userFollowsMap = new Map<string, typeof follows>();
    for (const f of follows) {
      const arr = userFollowsMap.get(f.user_wallet) || [];
      arr.push(f);
      userFollowsMap.set(f.user_wallet, arr);
    }

    // ── 2. Get today's SL/TP exits (dedup) ──────────
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const userWallets = [...userFollowsMap.keys()];

    // Clean up stale 'pending' rows older than 10 min (stuck from previous runs)
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await sb
      .from('ep_auto_trade_log')
      .update({ status: 'failed', error_message: 'Stale pending — timed out' })
      .eq('status', 'pending')
      .lt('created_at', staleThreshold)
      .like('signal_id', 'sltp-%');

    // Only skip tokens that were successfully executed today (allow retries on failed)
    const { data: todayExits } = await sb
      .from('ep_auto_trade_log')
      .select('signal_id, user_wallet')
      .in('user_wallet', userWallets)
      .eq('status', 'executed')
      .gte('created_at', todayStart.toISOString())
      .like('signal_id', 'sltp-%');

    const exitedToday = new Set(
      (todayExits || []).map((e: any) => `${e.user_wallet}:${e.signal_id}`),
    );

    // ── 3. For each user, check positions ────────────
    const userCredsCache = new Map<string, any>();

    for (const [userWallet, userFollows] of userFollowsMap) {
      try {
        // Fetch user's live positions
        const posRes = await fetch(
          `https://data-api.polymarket.com/positions?user=${userWallet}&sizeThreshold=0`,
          { cache: 'no-store' },
        );
        if (!posRes.ok) {
          console.warn(`[monitor] Position fetch failed for ${userWallet.slice(0, 10)}: ${posRes.status}`);
          continue;
        }
        const positions = await posRes.json();
        if (!positions || positions.length === 0) continue;

        // Fetch entry prices from copytrade executions
        // ep_user_trades has token_id + source='copytrade' + side='BUY'
        const { data: entryTrades } = await sb
          .from('ep_user_trades')
          .select('token_id, price, amount, shares, source_id')
          .eq('user_wallet', userWallet)
          .eq('source', 'copytrade')
          .eq('side', 'BUY');

        if (!entryTrades || entryTrades.length === 0) continue;

        // Build weighted average entry price per token_id
        const entryPriceMap = new Map<string, { avgPrice: number; totalShares: number }>();
        for (const t of entryTrades) {
          if (!t.token_id || !t.price || t.price <= 0) continue;
          const existing = entryPriceMap.get(t.token_id);
          const shares = t.shares || (t.amount / t.price);
          if (existing) {
            const totalCost = existing.avgPrice * existing.totalShares + t.price * shares;
            const totalShares = existing.totalShares + shares;
            entryPriceMap.set(t.token_id, { avgPrice: totalCost / totalShares, totalShares });
          } else {
            entryPriceMap.set(t.token_id, { avgPrice: t.price, totalShares: shares });
          }
        }

        // Map source_ids (signal_ids) to trader_ids for follow matching
        const signalIds = entryTrades.map((t: any) => t.source_id).filter(Boolean);
        let signalTraderMap = new Map<string, string>();
        if (signalIds.length > 0) {
          const { data: logs } = await sb
            .from('ep_auto_trade_log')
            .select('signal_id, trader_id')
            .in('signal_id', signalIds.slice(0, 200))
            .eq('status', 'executed');
          for (const l of logs || []) {
            signalTraderMap.set(l.signal_id, l.trader_id);
          }
        }

        // Build token_id → trader_id mapping (may have multiple, use first)
        const tokenTraderMap = new Map<string, string>();
        for (const t of entryTrades) {
          if (!t.token_id || tokenTraderMap.has(t.token_id)) continue;
          const traderId = signalTraderMap.get(t.source_id);
          if (traderId) tokenTraderMap.set(t.token_id, traderId);
        }

        // Build trader follow lookup
        const traderFollowMap = new Map(userFollows.map((f) => [f.trader_id, f]));

        // Fetch CLOB prices in batch
        const tokenIds = [...entryPriceMap.keys()];
        const livePrices = new Map<string, number>();
        const priceFetches = tokenIds.map((tokenId) =>
          fetch(`https://clob.polymarket.com/price?token_id=${tokenId}&side=SELL`, { next: { revalidate: 0 } })
            .then(async (res) => {
              if (!res.ok) return;
              const data = await res.json();
              const p = parseFloat(data.price);
              if (p > 0) livePrices.set(tokenId, p);
            })
            .catch(() => {}),
        );
        await Promise.allSettled(priceFetches);

        // Check each position against SL/TP
        for (const pos of positions) {
          const tokenId =
            (typeof pos.asset === 'string' ? pos.asset : pos.asset?.token_id) ||
            pos.asset_id || pos.tokenId || '';
          const size = parseFloat(pos.size || '0');
          if (!tokenId || size <= 0) continue;

          const entry = entryPriceMap.get(tokenId);
          if (!entry) continue; // Not a copytrade position

          const currentPrice = livePrices.get(tokenId);
          if (!currentPrice || currentPrice <= 0) continue;

          const pnlPct = ((currentPrice - entry.avgPrice) / entry.avgPrice) * 100;
          checked++;

          // Find the follow for this position's trader
          const traderId = tokenTraderMap.get(tokenId);
          if (!traderId) continue;
          const follow = traderFollowMap.get(traderId);
          if (!follow) continue;

          // Check thresholds
          let triggerReason: 'stop_loss' | 'take_profit' | null = null;
          if (follow.stop_loss_pct && pnlPct <= -follow.stop_loss_pct) {
            triggerReason = 'stop_loss';
          } else if (follow.take_profit_pct && pnlPct >= follow.take_profit_pct) {
            triggerReason = 'take_profit';
          }

          if (!triggerReason) continue;

          // Dedup: one SL/TP exit per token per day
          const today = new Date().toISOString().slice(0, 10);
          const dedupId = `sltp-${tokenId.slice(0, 16)}-${today}`;
          const dedupKey = `${userWallet}:${dedupId}`;
          if (exitedToday.has(dedupKey)) {
            skipped++;
            continue;
          }

          const triggerLabel = triggerReason === 'stop_loss' ? 'Stop Loss' : 'Take Profit';
          const pnlSign = pnlPct >= 0 ? '+' : '';
          console.log(
            `[monitor] ${triggerLabel} triggered for ${userWallet.slice(0, 10)}: ` +
            `${pnlSign}${pnlPct.toFixed(1)}% (threshold: ${triggerReason === 'stop_loss' ? `-${follow.stop_loss_pct}%` : `+${follow.take_profit_pct}%`}) ` +
            `token=${tokenId.slice(0, 12)}... shares=${size.toFixed(2)}`,
          );

          // ── Execute sell ──────────────────────────
          try {
            // Insert pending dedup row
            const { data: claimData, error: claimErr } = await sb
              .from('ep_auto_trade_log')
              .insert({
                signal_id: dedupId,
                user_wallet: userWallet,
                trader_id: traderId,
                status: 'pending',
                side: 'SELL',
                market_slug: pos.market_slug || pos.market_id || '',
                market_question: pos.title || pos.question || '',
                trader_alias: triggerLabel,
              })
              .select('id')
              .single();

            if (claimErr) {
              if (claimErr.code === '23505') { skipped++; continue; } // Already claimed
              console.warn('[monitor] Claim error:', claimErr);
              failed++;
              continue;
            }
            const claimId = claimData?.id;

            // Fetch user credentials
            let user = userCredsCache.get(userWallet);
            if (!user) {
              const { data, error: uerr } = await sb
                .from('ep_users')
                .select('wallet_address, eoa_address, clob_api_key, clob_api_secret, clob_api_passphrase, encrypted_private_key')
                .eq('wallet_address', userWallet)
                .single();

              if (uerr || !data || !data.clob_api_key) {
                await sb.from('ep_auto_trade_log').update({
                  status: 'failed',
                  error_message: 'No CLOB credentials',
                }).eq('id', claimId);
                failed++;
                continue;
              }
              user = data;
              userCredsCache.set(userWallet, data);
            }

            // Create CLOB client
            let clobClient: any;
            const builderConfig = await getBuilderConfig();
            const safeAddr = (user.eoa_address && user.wallet_address !== user.eoa_address)
              ? user.wallet_address
              : undefined;

            if (user.encrypted_private_key) {
              clobClient = await createServerClobClient(
                user.encrypted_private_key,
                user.clob_api_key,
                user.clob_api_secret,
                user.clob_api_passphrase,
                builderConfig,
                safeAddr,
              );
            } else if (isPrivyServerAvailable()) {
              const eoaAddr = user.eoa_address || user.wallet_address;
              const fundAddr = safeAddr || user.wallet_address;
              clobClient = await createPrivyClobClient(
                eoaAddr,
                fundAddr,
                user.clob_api_key,
                user.clob_api_secret,
                user.clob_api_passphrase,
                builderConfig,
              );
            } else {
              await sb.from('ep_auto_trade_log').update({
                status: 'failed',
                error_message: 'No signing method available',
              }).eq('id', claimId);
              failed++;
              continue;
            }

            // GTC limit sell with buffer below trigger price
            const bufferPct = follow.sl_buffer_pct ?? 15;
            let limitPrice: number;
            if (triggerReason === 'stop_loss') {
              // SL: limit price = entry * (1 - (SL% + buffer%) / 100)
              limitPrice = entry.avgPrice * (1 - (follow.stop_loss_pct + bufferPct) / 100);
            } else {
              // TP: sell slightly below current price to ensure fill
              limitPrice = currentPrice * 0.95;
            }
            // Clamp to Polymarket price range [0.01, 0.99], round to 2 decimals
            limitPrice = Math.max(0.01, Math.min(0.99, Math.round(limitPrice * 100) / 100));

            console.log(
              `[monitor] Placing GTC limit sell: token=${tokenId.slice(0, 12)}... ` +
              `size=${size.toFixed(2)} limitPrice=${limitPrice} ` +
              `(entry=${entry.avgPrice.toFixed(4)}, current=${currentPrice.toFixed(4)}, buffer=${bufferPct}%)`,
            );

            const result = await clobClient.createAndPostOrder({
              tokenID: tokenId,
              side: 'SELL',
              size: Math.floor(size * 100) / 100, // round down to 2 decimals
              price: limitPrice,
            });

            // createAndPostOrder returns { orderID, ... } or throws
            const orderId = result?.orderID || result?.id || JSON.stringify(result);
            const exitAmount = Math.round(size * limitPrice * 100) / 100;

            if (orderId && orderId !== '{}') {
              await sb.from('ep_auto_trade_log').update({
                status: 'executed',
                order_id: typeof orderId === 'string' ? orderId : JSON.stringify(orderId),
                amount: exitAmount,
                price: limitPrice,
                error_message: `${triggerLabel} GTC: ${pnlSign}${pnlPct.toFixed(1)}% (entry: ${(entry.avgPrice * 100).toFixed(1)}¢ → limit: ${(limitPrice * 100).toFixed(1)}¢)`,
              }).eq('id', claimId);

              // Log to ep_user_trades
              await sb.from('ep_user_trades').insert({
                user_wallet: userWallet,
                token_id: tokenId,
                side: 'SELL',
                amount: exitAmount,
                price: limitPrice,
                shares: size,
                order_id: typeof orderId === 'string' ? orderId : JSON.stringify(orderId),
                source: 'copytrade-monitor',
                source_id: dedupId,
                market_slug: pos.market_slug || pos.market_id || '',
              });

              triggered++;
              exitedToday.add(dedupKey);
              console.log(
                `[monitor] PLACED GTC ${triggerLabel}: ${userWallet.slice(0, 10)} selling ${size.toFixed(1)} shares ` +
                `at limit ${(limitPrice * 100).toFixed(1)}¢ (${pnlSign}${pnlPct.toFixed(1)}%)`,
              );
            } else {
              const errMsg = `Empty order result: ${JSON.stringify(result).slice(0, 200)}`;
              await sb.from('ep_auto_trade_log').update({
                status: 'failed',
                amount: exitAmount,
                price: limitPrice,
                error_message: `${triggerLabel} sell failed: ${errMsg}`,
              }).eq('id', claimId);
              failed++;
              console.error(`[monitor] ${triggerLabel} sell FAILED: ${errMsg}`);
            }
          } catch (err: any) {
            failed++;
            console.error(`[monitor] ${triggerLabel} error for ${userWallet.slice(0, 10)}:`, err.message);
          }
        }
      } catch (err: any) {
        console.error(`[monitor] Error processing ${userWallet.slice(0, 10)}:`, err.message);
      }
    }

    // ── 4. Per-trade TP/SL monitoring (Picks trades) ──────
    // Picks trades store absolute price targets on ep_user_trades
    // (e.g. take_profit=0.54 means "sell when price hits 54c")
    let perTradeChecked = 0;
    let perTradeTriggered = 0;
    let perTradeFailed = 0;

    try {
      // Fetch BUY trades that have TP or SL set
      const { data: tpSlTrades, error: tpSlErr } = await sb
        .from('ep_user_trades')
        .select('id, user_wallet, token_id, price, shares, amount, take_profit, stop_loss, order_id, source, source_id, market_slug')
        .eq('side', 'BUY')
        .or('take_profit.not.is.null,stop_loss.not.is.null');

      if (tpSlErr) {
        console.error('[monitor] Per-trade TP/SL query error:', tpSlErr);
      } else if (tpSlTrades && tpSlTrades.length > 0) {
        // Group by user_wallet
        const userTradesMap = new Map<string, typeof tpSlTrades>();
        for (const t of tpSlTrades) {
          const arr = userTradesMap.get(t.user_wallet) || [];
          arr.push(t);
          userTradesMap.set(t.user_wallet, arr);
        }

        for (const [userWallet, trades] of userTradesMap) {
          try {
            // Fetch user's live positions to confirm they still hold the token
            const posRes = await fetch(
              `https://data-api.polymarket.com/positions?user=${userWallet}&sizeThreshold=0`,
              { cache: 'no-store' },
            );
            if (!posRes.ok) continue;
            const positions = await posRes.json();
            if (!positions || positions.length === 0) continue;

            // Build set of token_ids with live positions
            const livePositions = new Map<string, number>();
            for (const pos of positions) {
              const tid = (typeof pos.asset === 'string' ? pos.asset : pos.asset?.token_id) || pos.asset_id || pos.tokenId || '';
              const sz = parseFloat(pos.size || '0');
              if (tid && sz > 0) livePositions.set(tid, sz);
            }

            // Collect unique token_ids that need price checks
            const tokenIdsToCheck = [...new Set(trades.map((t) => t.token_id).filter((tid) => livePositions.has(tid)))];
            if (tokenIdsToCheck.length === 0) continue;

            // Fetch live CLOB prices
            const tradePrices = new Map<string, number>();
            const pFetches = tokenIdsToCheck.map((tokenId) =>
              fetch(`https://clob.polymarket.com/price?token_id=${tokenId}&side=SELL`, { next: { revalidate: 0 } })
                .then(async (res) => {
                  if (!res.ok) return;
                  const data = await res.json();
                  const p = parseFloat(data.price);
                  if (p > 0) tradePrices.set(tokenId, p);
                })
                .catch(() => {}),
            );
            await Promise.allSettled(pFetches);

            for (const trade of trades) {
              const currentPrice = tradePrices.get(trade.token_id);
              if (!currentPrice) continue;

              const liveSize = livePositions.get(trade.token_id);
              if (!liveSize || liveSize <= 0) continue;

              perTradeChecked++;

              // Check absolute price thresholds
              let triggerReason: 'stop_loss' | 'take_profit' | null = null;
              if (trade.stop_loss && currentPrice <= trade.stop_loss) {
                triggerReason = 'stop_loss';
              } else if (trade.take_profit && currentPrice >= trade.take_profit) {
                triggerReason = 'take_profit';
              }
              if (!triggerReason) continue;

              // Dedup: one SL/TP exit per trade per day
              const today = new Date().toISOString().slice(0, 10);
              const dedupId = `sltp-trade-${trade.id}-${today}`;
              const dedupKey = `${userWallet}:${dedupId}`;
              if (exitedToday.has(dedupKey)) continue;

              const triggerLabel = triggerReason === 'stop_loss' ? 'Stop Loss' : 'Take Profit';
              const pnlPct = ((currentPrice - trade.price) / trade.price) * 100;
              const pnlSign = pnlPct >= 0 ? '+' : '';
              console.log(
                `[monitor] Per-trade ${triggerLabel}: ${userWallet.slice(0, 10)} ` +
                `entry=${(trade.price * 100).toFixed(1)}c current=${(currentPrice * 100).toFixed(1)}c ` +
                `target=${triggerReason === 'stop_loss' ? (trade.stop_loss * 100).toFixed(1) : (trade.take_profit * 100).toFixed(1)}c ` +
                `(${pnlSign}${pnlPct.toFixed(1)}%) shares=${liveSize.toFixed(2)}`,
              );

              try {
                // Insert pending dedup row
                const { data: claimData, error: claimErr } = await sb
                  .from('ep_auto_trade_log')
                  .insert({
                    signal_id: dedupId,
                    user_wallet: userWallet,
                    trader_id: trade.source_id || 'picks',
                    status: 'pending',
                    side: 'SELL',
                    market_slug: trade.market_slug || '',
                    market_question: '',
                    trader_alias: `Picks ${triggerLabel}`,
                  })
                  .select('id')
                  .single();

                if (claimErr) {
                  if (claimErr.code === '23505') continue; // Already claimed
                  console.warn('[monitor] Per-trade claim error:', claimErr);
                  perTradeFailed++;
                  continue;
                }
                const claimId = claimData?.id;

                // Fetch user credentials
                let user = userCredsCache.get(userWallet);
                if (!user) {
                  const { data, error: uerr } = await sb
                    .from('ep_users')
                    .select('wallet_address, eoa_address, clob_api_key, clob_api_secret, clob_api_passphrase, encrypted_private_key')
                    .eq('wallet_address', userWallet)
                    .single();

                  if (uerr || !data || !data.clob_api_key) {
                    await sb.from('ep_auto_trade_log').update({
                      status: 'failed',
                      error_message: 'No CLOB credentials',
                    }).eq('id', claimId);
                    perTradeFailed++;
                    continue;
                  }
                  user = data;
                  userCredsCache.set(userWallet, data);
                }

                // Create CLOB client
                let clobClient: any;
                const builderConfig = await getBuilderConfig();
                const safeAddr = (user.eoa_address && user.wallet_address !== user.eoa_address)
                  ? user.wallet_address
                  : undefined;

                if (user.encrypted_private_key) {
                  clobClient = await createServerClobClient(
                    user.encrypted_private_key,
                    user.clob_api_key,
                    user.clob_api_secret,
                    user.clob_api_passphrase,
                    builderConfig,
                    safeAddr,
                  );
                } else if (isPrivyServerAvailable()) {
                  const eoaAddr = user.eoa_address || user.wallet_address;
                  const fundAddr = safeAddr || user.wallet_address;
                  clobClient = await createPrivyClobClient(
                    eoaAddr,
                    fundAddr,
                    user.clob_api_key,
                    user.clob_api_secret,
                    user.clob_api_passphrase,
                    builderConfig,
                  );
                } else {
                  await sb.from('ep_auto_trade_log').update({
                    status: 'failed',
                    error_message: 'No signing method available',
                  }).eq('id', claimId);
                  perTradeFailed++;
                  continue;
                }

                // GTC limit sell — use 5% slippage below current for fast fill
                let limitPrice: number;
                if (triggerReason === 'stop_loss') {
                  // SL: limit well below SL price to ensure fill
                  limitPrice = trade.stop_loss * 0.85;
                } else {
                  // TP: limit slightly below current to ensure fill
                  limitPrice = currentPrice * 0.95;
                }
                limitPrice = Math.max(0.01, Math.min(0.99, Math.round(limitPrice * 100) / 100));

                const sellSize = Math.floor(liveSize * 100) / 100;
                const result = await clobClient.createAndPostOrder({
                  tokenID: trade.token_id,
                  side: 'SELL',
                  size: sellSize,
                  price: limitPrice,
                });

                const orderId = result?.orderID || result?.id || JSON.stringify(result);
                const exitAmount = Math.round(sellSize * limitPrice * 100) / 100;

                if (orderId && orderId !== '{}') {
                  await sb.from('ep_auto_trade_log').update({
                    status: 'executed',
                    order_id: typeof orderId === 'string' ? orderId : JSON.stringify(orderId),
                    amount: exitAmount,
                    price: limitPrice,
                    error_message: `Picks ${triggerLabel}: ${pnlSign}${pnlPct.toFixed(1)}% (entry: ${(trade.price * 100).toFixed(1)}c → limit: ${(limitPrice * 100).toFixed(1)}c)`,
                  }).eq('id', claimId);

                  // Log to ep_user_trades
                  await sb.from('ep_user_trades').insert({
                    user_wallet: userWallet,
                    token_id: trade.token_id,
                    side: 'SELL',
                    amount: exitAmount,
                    price: limitPrice,
                    shares: sellSize,
                    order_id: typeof orderId === 'string' ? orderId : JSON.stringify(orderId),
                    source: 'picks-monitor',
                    source_id: dedupId,
                    market_slug: trade.market_slug || '',
                  });

                  // Clear TP/SL on the original trade to prevent re-triggers
                  await sb.from('ep_user_trades')
                    .update({ take_profit: null, stop_loss: null })
                    .eq('id', trade.id);

                  perTradeTriggered++;
                  exitedToday.add(dedupKey);
                  console.log(
                    `[monitor] PLACED Picks ${triggerLabel}: ${userWallet.slice(0, 10)} selling ${sellSize} shares ` +
                    `at limit ${(limitPrice * 100).toFixed(1)}c (${pnlSign}${pnlPct.toFixed(1)}%)`,
                  );
                } else {
                  const errMsg = `Empty order result: ${JSON.stringify(result).slice(0, 200)}`;
                  await sb.from('ep_auto_trade_log').update({
                    status: 'failed',
                    amount: exitAmount,
                    price: limitPrice,
                    error_message: `Picks ${triggerLabel} failed: ${errMsg}`,
                  }).eq('id', claimId);
                  perTradeFailed++;
                }
              } catch (err: any) {
                perTradeFailed++;
                console.error(`[monitor] Per-trade ${triggerLabel} error:`, err.message);
              }
            }
          } catch (err: any) {
            console.error(`[monitor] Per-trade error for ${userWallet.slice(0, 10)}:`, err.message);
          }
        }
      }
    } catch (err: any) {
      console.error('[monitor] Per-trade TP/SL pass error:', err.message);
    }

    return NextResponse.json({
      checked: checked + perTradeChecked,
      triggered: triggered + perTradeTriggered,
      failed: failed + perTradeFailed,
      skipped,
      copytrade: { checked, triggered, failed },
      picks: { checked: perTradeChecked, triggered: perTradeTriggered, failed: perTradeFailed },
    });
  } catch (err: any) {
    console.error('SL/TP monitor error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
