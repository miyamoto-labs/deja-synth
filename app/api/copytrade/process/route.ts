import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';
import { createServerClobClient, getBuilderConfig } from '@/app/lib/server-signer';
import { createPrivyClobClient, isPrivyServerAvailable } from '@/app/lib/privy-server';
import { submitOrderToCLOB } from '@/app/lib/clob-proxy';
import { decrypt } from '@/app/lib/crypto';

export const dynamic = 'force-dynamic';

const GAMMA_API = 'https://gamma-api.polymarket.com';
const MAX_SIGNAL_AGE_MS = 10 * 60 * 1000; // Only process signals from last 10 min
const CLOB_MIN_AMOUNT = 5; // Polymarket CLOB minimum order size ($5)

/** Helper: log a copytrade attempt (success, failure, or skip) to ep_auto_trade_log */
async function logActivity(
  sb: ReturnType<typeof getSupabase>,
  entry: {
    user_wallet: string;
    signal_id: string;
    trader_id: string;
    status: 'executed' | 'failed' | 'skipped' | 'pending';
    order_id?: string;
    amount?: number;
    market_slug?: string;
    market_question?: string;
    side?: string;
    direction?: string;
    price?: number;
    trader_alias?: string;
    error_message?: string;
  },
) {
  try {
    await sb.from('ep_auto_trade_log').insert(entry);
  } catch (err) {
    // Non-fatal — don't break the processor if logging fails
    console.warn('Failed to log copytrade activity:', err);
  }
}

/**
 * Claim a signal for execution by inserting a "pending" row.
 * Uses the unique partial index on (signal_id, user_wallet) WHERE status IN ('executed','pending')
 * to atomically prevent concurrent processors from both claiming the same signal.
 * Returns true if the claim was successful (this processor owns it).
 */
async function claimSignalForExecution(
  sb: ReturnType<typeof getSupabase>,
  entry: {
    user_wallet: string;
    signal_id: string;
    trader_id: string;
    market_slug?: string;
    market_question?: string;
    side?: string;
    direction?: string;
    trader_alias?: string;
  },
): Promise<{ claimed: boolean; claimId?: string }> {
  try {
    const { data, error } = await sb
      .from('ep_auto_trade_log')
      .insert({
        ...entry,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      // Unique constraint violation = another processor already claimed it
      if (error.code === '23505') {
        return { claimed: false };
      }
      console.warn('Claim insert error:', error);
      return { claimed: false };
    }

    return { claimed: true, claimId: data?.id };
  } catch (err) {
    console.warn('Claim signal error:', err);
    return { claimed: false };
  }
}

/**
 * Finalize a claimed signal: update the pending row to executed, failed, or skipped.
 */
async function finalizeSignalClaim(
  sb: ReturnType<typeof getSupabase>,
  claimId: string,
  update: {
    status: 'executed' | 'failed' | 'skipped';
    order_id?: string;
    amount?: number;
    price?: number;
    error_message?: string;
  },
) {
  try {
    await sb
      .from('ep_auto_trade_log')
      .update(update)
      .eq('id', claimId);
  } catch (err) {
    console.warn('Finalize claim error:', err);
  }
}

/**
 * GET /api/copytrade/process
 *
 * Called every 5 min by run.py via trigger_copytrade_processor().
 * Also triggered instantly by onchain_monitor.py after signal insertion.
 * Finds all pending copy-trade signals across ALL users with active follows,
 * auto-executes for auto_trade=true users, and sends notifications for manual users.
 * and executes them server-side via the CLOB API.
 *
 * Auth: Authorization: Bearer {CRON_SECRET}
 * Response: { executed, notified, skipped, failed }
 */
export async function GET(request: Request) {
  try {
    // ── Auth ──────────────────────────────────────────
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tProcessorStart = Date.now();
    const triggerSource = request.headers.get('x-trigger-source') || 'cron';
    console.log(`[processor] phase=start trigger=${triggerSource}`);

    const sb = getSupabase();
    let executed = 0;
    let skipped = 0;
    let failed = 0;

    // ── 1. Fetch ALL active follows (auto + manual) ───────
    const tFollows = Date.now();
    const { data: rawFollows, error: followsErr } = await sb
      .from('ep_user_follows')
      .select('id, user_wallet, trader_id, amount_per_trade, max_daily_trades, copy_buy, copy_sell, sizing_mode, sizing_value, min_trade_size, max_per_trade, max_per_market, total_spend_limit, total_spent, slippage_buy_pct, slippage_sell_pct, stop_loss_pct, take_profit_pct, sl_buffer_pct, auto_trade, active')
      .eq('active', true);

    if (followsErr) throw followsErr;

    console.log(`[processor] phase=fetch_follows duration_ms=${Date.now() - tFollows}`);

    // WORKAROUND: Supabase JS client `.eq('active', true)` sometimes returns inactive rows.
    // Apply JS-level filter to guarantee only active follows are processed.
    const rawList = rawFollows || [];
    const allFollows = rawList.filter((f: any) => f.active === true || f.active === 'true');

    console.log(
      `[copytrade] Follows: ${rawList.length} raw → ${allFollows.length} after JS active filter`,
      allFollows.map((f) => `${f.trader_id.slice(0, 8)}:auto=${f.auto_trade}(${typeof f.auto_trade})`).join(', '),
    );

    if (allFollows.length === 0) {
      return NextResponse.json({ executed: 0, notified: 0, skipped: 0, failed: 0 });
    }

    // Group follows by user + build trader ID set
    const userFollowsMap = new Map<string, typeof allFollows>();
    const allTraderIds = new Set<string>();
    for (const f of allFollows) {
      const existing = userFollowsMap.get(f.user_wallet) || [];
      existing.push(f);
      userFollowsMap.set(f.user_wallet, existing);
      allTraderIds.add(f.trader_id);
    }

    const traderIdList = [...allTraderIds];
    if (traderIdList.length === 0) {
      return NextResponse.json({ executed: 0, notified: 0, skipped: 0, failed: 0 });
    }

    // ── 1b. Fetch trader aliases (for activity display) ──
    const traderAliasMap = new Map<string, string>();
    try {
      const { data: traders } = await sb
        .from('ep_tracked_traders')
        .select('id, alias')
        .in('id', traderIdList);
      for (const t of traders || []) {
        traderAliasMap.set(t.id, t.alias || 'Unknown');
      }
    } catch {
      // Non-critical
    }

    // ── 2. Fetch recent signals (10-min window) ──────
    const tSignals = Date.now();
    const signalCutoff = new Date(Date.now() - MAX_SIGNAL_AGE_MS).toISOString();

    const { data: signals, error: signalsErr } = await sb
      .from('ep_trader_trades')
      .select('*')
      .in('trader_id', traderIdList)
      .gte('timestamp', signalCutoff)
      .order('timestamp', { ascending: false })
      .limit(200);

    if (signalsErr) throw signalsErr;
    if (!signals || signals.length === 0) {
      console.log(`[processor] phase=fetch_signals count=0 duration_ms=${Date.now() - tSignals}`);
      return NextResponse.json({ executed: 0, notified: 0, skipped: 0, failed: 0 });
    }

    const oldestSignalAge = Date.now() - new Date(signals[signals.length - 1].timestamp).getTime();
    console.log(`[processor] phase=fetch_signals count=${signals.length} oldest_age_ms=${Math.round(oldestSignalAge)} duration_ms=${Date.now() - tSignals}`);

    // ── 3. Dedup: already-executed signals + daily counts ──
    const signalIds = signals.map((s: any) => s.id);
    const userWallets = [...userFollowsMap.keys()];

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    // Also fetch failed attempt counts to cap retries (prevents infinite retry loops)
    const MAX_RETRIES = 3;

    const recentCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 min ago

    const tDedup = Date.now();
    const [execLogsRes, skippedLogsRes, todayLogsRes, dismissedRes, failedCountsRes, recentMarketsRes, marketSpendRes] = await Promise.all([
      // Already-executed OR pending signal IDs (for dedup — pending = another processor claimed it)
      sb.from('ep_auto_trade_log')
        .select('signal_id, user_wallet')
        .in('signal_id', signalIds)
        .in('status', ['executed', 'pending']),
      // Already-skipped signal IDs (for dedup — prevents re-notification spam)
      sb.from('ep_auto_trade_log')
        .select('signal_id, user_wallet')
        .in('signal_id', signalIds)
        .eq('status', 'skipped'),
      // Today's executions per user+trader (for daily limit) — only count executed ones
      sb.from('ep_auto_trade_log')
        .select('user_wallet, trader_id')
        .in('user_wallet', userWallets)
        .eq('status', 'executed')
        .gte('created_at', todayStart.toISOString()),
      // Dismissed signals
      sb.from('ep_auto_trade_dismissed')
        .select('signal_id, user_wallet')
        .in('user_wallet', userWallets),
      // Count failed attempts per signal+user (to cap retries)
      sb.from('ep_auto_trade_log')
        .select('signal_id, user_wallet')
        .in('signal_id', signalIds)
        .eq('status', 'failed'),
      // Recently executed markets per user (market-level dedup across signal sources)
      sb.from('ep_auto_trade_log')
        .select('user_wallet, market_slug')
        .in('user_wallet', userWallets)
        .eq('status', 'executed')
        .gte('created_at', recentCutoff),
      // Per-market spend totals per user (for max_per_market enforcement)
      sb.from('ep_auto_trade_log')
        .select('user_wallet, market_slug, amount')
        .in('user_wallet', userWallets)
        .eq('status', 'executed'),
    ]);

    // Build per-user processed signal set (executed/pending only).
    // Skipped signals are NOT deduped here — they should be retryable
    // (e.g. a sell that was skipped due to filters can be retried after fix).
    const userProcessed = new Map<string, Set<string>>();
    for (const log of execLogsRes.data || []) {
      if (!userProcessed.has(log.user_wallet)) userProcessed.set(log.user_wallet, new Set());
      userProcessed.get(log.user_wallet)!.add(log.signal_id);
    }

    // Build per-user per-trader daily count
    const dailyCounts = new Map<string, Map<string, number>>();
    for (const log of todayLogsRes.data || []) {
      if (!dailyCounts.has(log.user_wallet)) dailyCounts.set(log.user_wallet, new Map());
      const tm = dailyCounts.get(log.user_wallet)!;
      tm.set(log.trader_id, (tm.get(log.trader_id) || 0) + 1);
    }

    // Build per-user dismissed set
    const userDismissed = new Map<string, Set<string>>();
    for (const d of dismissedRes.data || []) {
      if (!userDismissed.has(d.user_wallet)) userDismissed.set(d.user_wallet, new Set());
      userDismissed.get(d.user_wallet)!.add(d.signal_id);
    }

    // Build per-user per-signal failed attempt count
    const failedCounts = new Map<string, number>();
    for (const f of failedCountsRes.data || []) {
      const key = `${f.user_wallet}:${f.signal_id}`;
      failedCounts.set(key, (failedCounts.get(key) || 0) + 1);
    }

    // Build per-user recently executed markets set (prevents duplicate copies
    // when the same on-chain trade is detected by both webhook + onchain_monitor)
    const userRecentMarkets = new Map<string, Set<string>>();
    for (const r of recentMarketsRes.data || []) {
      if (!r.market_slug) continue;
      if (!userRecentMarkets.has(r.user_wallet)) userRecentMarkets.set(r.user_wallet, new Set());
      userRecentMarkets.get(r.user_wallet)!.add(r.market_slug);
    }

    // Build per-user per-market spend totals (for max_per_market enforcement)
    const userMarketSpend = new Map<string, Map<string, number>>();
    for (const r of marketSpendRes.data || []) {
      if (!r.market_slug) continue;
      if (!userMarketSpend.has(r.user_wallet)) userMarketSpend.set(r.user_wallet, new Map());
      const mm = userMarketSpend.get(r.user_wallet)!;
      mm.set(r.market_slug, (mm.get(r.market_slug) || 0) + (r.amount || 0));
    }

    console.log(`[processor] phase=dedup_queries duration_ms=${Date.now() - tDedup}`);

    // ── 4. Resolve market data + token IDs ───────────
    const tMarkets = Date.now();
    const marketIds = [...new Set(signals.map((s: any) => s.market_id).filter(Boolean))];
    const marketsMap = new Map<string, any>();

    if (marketIds.length > 0) {
      const { data: markets } = await sb
        .from('ep_markets_raw')
        .select('market_id, question, yes_price, no_price, yes_token, no_token')
        .in('market_id', marketIds);

      for (const m of markets || []) {
        marketsMap.set(m.market_id, m);
      }
    }

    // Gamma API fallback for markets missing token IDs
    const missingSlugs = marketIds.filter((id) => {
      const m = marketsMap.get(id);
      return !m || !m.yes_token || !m.no_token;
    });

    if (missingSlugs.length > 0) {
      const gammaResults = await Promise.allSettled(
        missingSlugs.slice(0, 20).map(async (slug) => {
          try {
            const res = await fetch(
              `${GAMMA_API}/markets?slug=${encodeURIComponent(slug)}&limit=1`,
              { next: { revalidate: 0 } },
            );
            if (!res.ok) return null;
            const data = await res.json();
            const gm = Array.isArray(data) ? data[0] : data;
            if (!gm) return null;

            let tokens: string[] = [];
            try {
              const raw = gm.clobTokenIds || '[]';
              tokens = typeof raw === 'string' ? JSON.parse(raw) : raw;
            } catch { /* skip */ }

            let yesPrice = null;
            let noPrice = null;
            try {
              const prices = JSON.parse(gm.outcomePrices || '[]');
              if (prices.length >= 2) {
                yesPrice = parseFloat(prices[0]);
                noPrice = parseFloat(prices[1]);
              }
            } catch { /* skip */ }

            return {
              slug,
              question: gm.question || slug,
              yes_token: tokens[0] || null,
              no_token: tokens[1] || null,
              yes_price: yesPrice,
              no_price: noPrice,
            };
          } catch {
            return null;
          }
        }),
      );

      for (const result of gammaResults) {
        if (result.status !== 'fulfilled' || !result.value) continue;
        const gm = result.value;
        const existing = marketsMap.get(gm.slug) || {};
        marketsMap.set(gm.slug, {
          ...existing,
          market_id: gm.slug,
          question: gm.question,
          yes_token: existing.yes_token || gm.yes_token,
          no_token: existing.no_token || gm.no_token,
          yes_price: gm.yes_price ?? existing.yes_price,
          no_price: gm.no_price ?? existing.no_price,
        });
      }
    }

    console.log(`[processor] phase=market_data cache_hits=${marketsMap.size} gamma_fallbacks=${missingSlugs.length} duration_ms=${Date.now() - tMarkets}`);

    // ── 5. Build pending trades per user ─────────────
    interface PendingTrade {
      signalId: string;
      traderId: string;
      traderAlias: string;
      userWallet: string;
      followId: string;
      marketId: string;
      marketQuestion: string;
      direction: string;
      traderPrice: number;
      tokenId: string;
      currentPrice: number;
      suggestedAmount: number;
      slippagePct: number;
      side: 'BUY' | 'SELL';
      autoTrade: boolean;
    }

    const allPending: PendingTrade[] = [];

    // Debug skip counters
    const skipReasons: Record<string, number> = {
      noFollow: 0,
      deduped: 0,
      dismissed: 0,
      dailyLimit: 0,
      directionFilter: 0,
      minTradeSize: 0,
      spendLimit: 0,
      noMarket: 0,
      noToken: 0,
      budgetSmall: 0,
      extremePrice: 0,
      marketDedup: 0,
    };

    for (const [userWallet, follows] of userFollowsMap.entries()) {
      const followMap = new Map(follows.map((f) => [f.trader_id, f]));
      const processedSet = userProcessed.get(userWallet) || new Set();
      const dismissedSet = userDismissed.get(userWallet) || new Set();
      const userDailyCounts = dailyCounts.get(userWallet) || new Map();

      // Track signals we've already processed THIS run (prevent duplicate log entries)
      const processedThisRun = new Set<string>();

      for (const signal of signals) {
        const follow = followMap.get(signal.trader_id);
        if (!follow) { skipReasons.noFollow++; continue; }

        const traderAlias = traderAliasMap.get(signal.trader_id) || 'Unknown';

        // Dedup: skip signals already processed (executed or skipped/notified)
        if (processedSet.has(signal.id)) { skipReasons.deduped++; continue; }
        if (dismissedSet.has(signal.id)) { skipReasons.dismissed++; continue; }
        // Skip signals already processed in this run (prevent duplicate logs)
        if (processedThisRun.has(signal.id)) continue;
        processedThisRun.add(signal.id);

        // Cap retries: stop retrying after MAX_RETRIES failed attempts
        const failKey = `${userWallet}:${signal.id}`;
        const failCount = failedCounts.get(failKey) || 0;
        if (failCount >= MAX_RETRIES) {
          skipReasons.deduped++;
          continue;
        }

        // Determine trade type early — needed for entry-only filters below
        const isEntry = signal.trade_type === 'entry';
        const isExit = signal.trade_type === 'exit';

        // Market-level dedup: skip if user already executed a trade on this market
        // in the last 30 minutes (prevents duplicates from webhook + onchain_monitor)
        const recentMarkets = userRecentMarkets.get(userWallet);
        if (recentMarkets?.has(signal.market_id)) { skipReasons.marketDedup++; continue; }

        // Skip tiny BUY signals below CLOB minimum ($5).
        // For sells, position size matters, not signal amount — checked later during execution.
        if (isEntry && (signal.amount || 0) < CLOB_MIN_AMOUNT) { skipReasons.minTradeSize++; continue; }

        // Per-trader daily limit
        const used = userDailyCounts.get(signal.trader_id) || 0;
        if (used >= follow.max_daily_trades) {
          await logActivity(sb, {
            user_wallet: userWallet,
            signal_id: signal.id,
            trader_id: signal.trader_id,
            status: 'skipped',
            market_slug: signal.market_id,
            market_question: marketsMap.get(signal.market_id)?.question || signal.market_id,
            direction: signal.direction || 'YES',
            trader_alias: traderAlias,
            error_message: `Daily limit reached (${used}/${follow.max_daily_trades})`,
          });
          skipped++;
          continue;
        }

        // Direction filter: copy_buy = copy entries, copy_sell = copy exits.
        // Direction (YES/NO) indicates which outcome, NOT buy vs sell.
        if (isEntry && follow.copy_buy === false) { skipReasons.directionFilter++; continue; }
        if (isExit && follow.copy_sell === false) { skipReasons.directionFilter++; continue; }

        // Min trade size filter
        if (follow.min_trade_size && signal.amount < follow.min_trade_size) { skipReasons.minTradeSize++; continue; }

        // Total spend limit check
        if (follow.total_spend_limit && (parseFloat(follow.total_spent) || 0) >= follow.total_spend_limit) {
          await logActivity(sb, {
            user_wallet: userWallet,
            signal_id: signal.id,
            trader_id: signal.trader_id,
            status: 'skipped',
            market_slug: signal.market_id,
            market_question: marketsMap.get(signal.market_id)?.question || signal.market_id,
            direction: signal.direction || 'YES',
            trader_alias: traderAlias,
            error_message: `Spend limit reached ($${parseFloat(follow.total_spent) || 0}/$${follow.total_spend_limit})`,
          });
          skipped++;
          continue;
        }

        // Max per market check
        if (isEntry && follow.max_per_market) {
          const marketSpent = userMarketSpend.get(userWallet)?.get(signal.market_id) || 0;
          if (marketSpent >= follow.max_per_market) {
            await logActivity(sb, {
              user_wallet: userWallet,
              signal_id: signal.id,
              trader_id: signal.trader_id,
              status: 'skipped',
              market_slug: signal.market_id,
              market_question: marketsMap.get(signal.market_id)?.question || signal.market_id,
              direction: signal.direction || 'YES',
              trader_alias: traderAlias,
              error_message: `Market limit reached ($${marketSpent.toFixed(0)}/$${follow.max_per_market})`,
            });
            skipped++;
            continue;
          }
        }

        // Resolve market + token
        const market = marketsMap.get(signal.market_id);
        if (!market) {
          await logActivity(sb, {
            user_wallet: userWallet,
            signal_id: signal.id,
            trader_id: signal.trader_id,
            status: 'skipped',
            market_slug: signal.market_id,
            direction: signal.direction || 'YES',
            trader_alias: traderAlias,
            error_message: 'Market data not found',
          });
          skipped++;
          continue;
        }

        const direction = signal.direction || 'YES';
        const tokenId = direction === 'YES' ? market.yes_token : market.no_token;
        const currentPrice = direction === 'YES' ? market.yes_price : market.no_price;
        if (!tokenId || !currentPrice || currentPrice <= 0) {
          await logActivity(sb, {
            user_wallet: userWallet,
            signal_id: signal.id,
            trader_id: signal.trader_id,
            status: 'skipped',
            market_slug: signal.market_id,
            market_question: market.question || signal.market_id,
            direction,
            trader_alias: traderAlias,
            error_message: !tokenId ? 'Token ID missing' : 'Invalid market price',
          });
          skipped++;
          continue;
        }

        // Skip near-resolved markets for BUYS — price at extreme means
        // negligible profit. Sells at extreme prices are valid (taking profit).
        if (isEntry && (currentPrice > 0.95 || currentPrice < 0.05)) {
          skipReasons.extremePrice++;
          continue;
        }

        // Calculate suggested amount
        let suggestedAmount: number;
        if (follow.sizing_mode === 'percentage') {
          suggestedAmount = Math.round(((signal.amount || 0) * (follow.sizing_value || 10)) / 100);
          if (follow.max_per_trade && suggestedAmount > follow.max_per_trade) {
            suggestedAmount = follow.max_per_trade;
          }
          suggestedAmount = Math.max(suggestedAmount, CLOB_MIN_AMOUNT);
        } else {
          suggestedAmount = Math.max(follow.amount_per_trade || 10, CLOB_MIN_AMOUNT);
        }

        // Cap at remaining market budget
        if (isEntry && follow.max_per_market) {
          const marketSpent = userMarketSpend.get(userWallet)?.get(signal.market_id) || 0;
          const marketRemaining = follow.max_per_market - marketSpent;
          if (suggestedAmount > marketRemaining) {
            suggestedAmount = Math.floor(marketRemaining);
          }
        }

        // Cap at remaining spend budget
        if (follow.total_spend_limit) {
          const remaining = follow.total_spend_limit - (parseFloat(follow.total_spent) || 0);
          if (suggestedAmount > remaining) {
            suggestedAmount = Math.floor(remaining);
            if (suggestedAmount < 1) {
              await logActivity(sb, {
                user_wallet: userWallet,
                signal_id: signal.id,
                trader_id: signal.trader_id,
                status: 'skipped',
                market_slug: signal.market_id,
                market_question: market.question || signal.market_id,
                direction,
                trader_alias: traderAlias,
                error_message: `Remaining budget too small ($${remaining.toFixed(2)})`,
              });
              skipped++;
              continue;
            }
          }
        }

        const slippagePct = isEntry
          ? (follow.slippage_buy_pct || 10.0)
          : (follow.slippage_sell_pct || 10.0);

        // Determine CLOB side: entry=BUY, exit=SELL
        const side: 'BUY' | 'SELL' = signal.trade_type === 'exit' ? 'SELL' : 'BUY';

        // Mark this market as "in progress" for this user so duplicate signals
        // from the same batch (e.g. webhook + onchain_monitor) get caught
        if (!userRecentMarkets.has(userWallet)) userRecentMarkets.set(userWallet, new Set());
        userRecentMarkets.get(userWallet)!.add(signal.market_id);

        allPending.push({
          signalId: signal.id,
          traderId: signal.trader_id,
          traderAlias,
          userWallet,
          followId: follow.id,
          marketId: signal.market_id,
          marketQuestion: market.question || signal.market_id,
          direction,
          traderPrice: signal.price || 0,
          tokenId,
          currentPrice,
          suggestedAmount,
          slippagePct,
          side,
          autoTrade: !!follow.auto_trade,
        });
      }
    }

    // ── 6. Fetch LIVE prices from CLOB orderbook ──────────────
    // The cached prices from ep_markets_raw / Gamma can be stale.
    // Fetch the real best-ask (for buys) or best-bid (for sells) from the
    // CLOB for each token so we trade at the actual market price.
    //
    // Build a set of (tokenId, side) pairs — a token may appear in both
    // buy and sell signals, so we fetch the correct side for each.
    const buyTokens = new Set<string>();
    const sellTokens = new Set<string>();
    for (const t of allPending) {
      if (!t.tokenId) continue;
      if (t.side === 'SELL') sellTokens.add(t.tokenId);
      else buyTokens.add(t.tokenId);
    }

    const tPrices = Date.now();
    const livePriceMap = new Map<string, number>();     // BUY-side (best ask)
    const liveBidPriceMap = new Map<string, number>();  // SELL-side (best bid)

    const priceFetches: Promise<void>[] = [];

    for (const tokenId of buyTokens) {
      priceFetches.push(
        fetch(`https://clob.polymarket.com/price?token_id=${tokenId}&side=BUY`, { next: { revalidate: 0 } })
          .then(async (res) => {
            if (!res.ok) return;
            const data = await res.json();
            const p = parseFloat(data.price);
            if (p > 0) livePriceMap.set(tokenId, p);
          })
          .catch(() => {}),
      );
    }

    for (const tokenId of sellTokens) {
      priceFetches.push(
        fetch(`https://clob.polymarket.com/price?token_id=${tokenId}&side=SELL`, { next: { revalidate: 0 } })
          .then(async (res) => {
            if (!res.ok) return;
            const data = await res.json();
            const p = parseFloat(data.price);
            if (p > 0) liveBidPriceMap.set(tokenId, p);
          })
          .catch(() => {}),
      );
    }

    await Promise.allSettled(priceFetches);
    console.log(`[processor] phase=clob_prices buy_tokens=${buyTokens.size} sell_tokens=${sellTokens.size} duration_ms=${Date.now() - tPrices}`);

    // Update prices with live CLOB data (more accurate than cached).
    const afterSlippage: PendingTrade[] = [];
    for (const trade of allPending) {
      if (trade.side === 'SELL') {
        const bidPrice = liveBidPriceMap.get(trade.tokenId);
        if (bidPrice) trade.currentPrice = bidPrice;
      } else {
        const askPrice = livePriceMap.get(trade.tokenId);
        if (askPrice) trade.currentPrice = askPrice;
      }
      afterSlippage.push(trade);
    }

    // ── 7. Split auto vs manual trades ───────────────
    const autoTrades = afterSlippage.filter((t) => t.autoTrade);
    const manualTrades = afterSlippage.filter((t) => !t.autoTrade);

    // ── 8. Auto-trades: server-side execution via residential proxy ──
    // ClobClient.createOrder() works from Vercel (GET calls for tick size/negRisk).
    // Only the POST to CLOB is Cloudflare-blocked from datacenter IPs.
    // submitOrderToCLOB() routes the POST through a Decodo residential proxy
    // (CLOB_PROXY_URL env var). Falls back to browser execution if no proxy set.
    const hasProxy = !!process.env.CLOB_PROXY_URL;

    if (!hasProxy && autoTrades.length > 0) {
      console.log(
        `[copytrade] ${autoTrades.length} auto-trade signals queued for browser execution ` +
        `(CLOB_PROXY_URL not set — no server-side proxy available)`,
      );
    }

    // Cache user credentials per wallet (avoid re-fetching for multiple trades)
    const userCredsCache = new Map<string, any>();

    // Track daily counts within this batch to prevent overspending in one run
    const batchDailyCounts = new Map<string, Map<string, number>>();
    for (const [wallet, traderMap] of dailyCounts) {
      batchDailyCounts.set(wallet, new Map(traderMap));
    }

    const tradeTimings: number[] = [];
    for (const trade of autoTrades) {
      if (!hasProxy) break; // No proxy = skip server execution, browser will handle

      // Hoist claimId so it's accessible in catch block for cleanup
      let claimId: string | undefined;
      const tTrade = Date.now();

      try {
        // ── Atomic claim: insert a "pending" row to lock this signal for this user ──
        // The unique partial index on (signal_id, user_wallet) WHERE status IN ('executed','pending')
        // ensures only ONE processor can claim a signal. If another processor already claimed it
        // (or it was already executed), this insert fails with a constraint violation.
        const tClaim = Date.now();
        const { claimed, claimId: cid } = await claimSignalForExecution(sb, {
          user_wallet: trade.userWallet,
          signal_id: trade.signalId,
          trader_id: trade.traderId,
          market_slug: trade.marketId,
          market_question: trade.marketQuestion,
          side: trade.side,
          direction: trade.direction,
          trader_alias: trade.traderAlias,
        });
        console.log(`[processor] phase=claim user=${trade.userWallet.slice(0, 10)} claimed=${claimed} duration_ms=${Date.now() - tClaim}`);
        if (!claimed) {
          console.log(`[copytrade] Dedup: ${trade.signalId.slice(0, 8)} already claimed/executed for ${trade.userWallet.slice(0, 10)} — skipping`);
          skipped++;
          continue;
        }
        claimId = cid;

        // ── In-batch daily limit check ──
        const batchTraderCounts = batchDailyCounts.get(trade.userWallet) || new Map();
        const follow = allFollows.find((f) => f.id === trade.followId);
        const batchUsed = batchTraderCounts.get(trade.traderId) || 0;
        if (follow && batchUsed >= follow.max_daily_trades) {
          console.log(`[copytrade] Batch daily limit: ${batchUsed}/${follow.max_daily_trades} for trader ${trade.traderAlias} — skipping`);
          skipped++;
          continue;
        }
        // Fetch user credentials (cached per wallet)
        // Check for a linked copytrade wallet — if present, use its credentials for signing
        const tCreds = Date.now();
        let credsSource = 'cache';
        let user = userCredsCache.get(trade.userWallet);
        if (!user) {
          credsSource = 'db';
          const { data: authUser, error: uerr } = await sb
            .from('ep_users')
            .select('wallet_address, eoa_address, clob_api_key, clob_api_secret, clob_api_passphrase, encrypted_private_key, copytrade_wallet')
            .eq('wallet_address', trade.userWallet)
            .single();

          // If user has a copytrade wallet, use those credentials instead
          let data = authUser;
          if (authUser?.copytrade_wallet) {
            const { data: ctWallet } = await sb
              .from('ep_users')
              .select('wallet_address, eoa_address, clob_api_key, clob_api_secret, clob_api_passphrase, encrypted_private_key')
              .eq('wallet_address', authUser.copytrade_wallet)
              .single();
            if (ctWallet?.clob_api_key) {
              data = ctWallet;
              console.log(`[processor] Using copytrade wallet ${ctWallet.wallet_address.slice(0, 10)}.. for ${trade.userWallet.slice(0, 10)}..`);
            }
          }

          if (uerr || !data || !data.clob_api_key) {
            await finalizeSignalClaim(sb, claimId!, {
              status: 'failed',
              error_message: 'No CLOB credentials — user needs to reconnect wallet',
            });
            failed++;
            continue;
          }
          user = data;
          userCredsCache.set(trade.userWallet, data);
        }
        console.log(`[processor] phase=load_creds user=${trade.userWallet.slice(0, 10)} source=${credsSource} duration_ms=${Date.now() - tCreds}`);

        // Create server-side CLOB client for signing
        const tSign = Date.now();
        let clobClient: any;
        let signMethod = 'unknown';
        const builderConfig = await getBuilderConfig();
        const safeAddr = (user.eoa_address && user.wallet_address !== user.eoa_address)
          ? user.wallet_address
          : undefined;

        if (user.encrypted_private_key) {
          // Stored key signing (MetaMask users who shared their key)
          signMethod = 'stored_key';
          clobClient = await createServerClobClient(
            user.encrypted_private_key,
            user.clob_api_key,
            user.clob_api_secret,
            user.clob_api_passphrase,
            builderConfig,
            safeAddr,
          );
        } else if (isPrivyServerAvailable()) {
          // Privy server signing (social auth users)
          signMethod = 'privy';
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
          await finalizeSignalClaim(sb, claimId!, {
            status: 'failed',
            error_message: 'No signing method available (no private key, Privy not configured)',
          });
          failed++;
          continue;
        }

        console.log(`[processor] phase=sign user=${trade.userWallet.slice(0, 10)} method=${signMethod} duration_ms=${Date.now() - tSign}`);

        // For SELL (exit) trades: sell the user's ENTIRE position, not just $10.
        // This mirrors the trader's strategy — when they exit, we exit fully.
        // Trading wallet (holds USDC + positions): copytrade wallet or Safe/auth wallet
        const tradingWallet = user.wallet_address;
        // EOA address for CLOB HMAC auth header (POLY_ADDRESS)
        const polyAddress = user.eoa_address || user.wallet_address;
        let shares: number;
        if (trade.side === 'SELL') {
          try {
            const posRes = await fetch(
              `https://data-api.polymarket.com/positions?user=${tradingWallet}&sizeThreshold=0`,
              { cache: 'no-store' },
            );
            if (posRes.ok) {
              const positions = await posRes.json();
              const match = (positions || []).find((p: any) => {
                const tokenId =
                  (typeof p.asset === 'string' ? p.asset : p.asset?.token_id) ||
                  p.asset_id || p.tokenId || '';
                return tokenId === trade.tokenId;
              });
              if (match && parseFloat(match.size || '0') > 0) {
                shares = parseFloat(match.size);
                console.log(
                  `[copytrade] EXIT: selling full position ${shares} shares of ${trade.tokenId.slice(0, 12)}...`,
                );
              } else {
                // User has no position in this market — permanently skip (not a retriable failure).
                // Mark as 'skipped' so dedup prevents retrying: user never copied this entry,
                // so a sell signal for it will never succeed.
                console.log(
                  `[copytrade] EXIT: no position found for ${trade.tokenId.slice(0, 12)}... — permanently skipping`,
                );
                await finalizeSignalClaim(sb, claimId!, {
                  status: 'skipped',
                  error_message: 'No position found — nothing to sell',
                });
                skipped++;
                continue;
              }
            } else {
              // Fallback to dollar-based sizing if position lookup fails
              shares = trade.suggestedAmount / trade.currentPrice;
              console.warn('[copytrade] EXIT: position lookup failed, using dollar sizing fallback');
            }
          } catch (err: any) {
            shares = trade.suggestedAmount / trade.currentPrice;
            console.warn('[copytrade] EXIT: position lookup error:', err.message);
          }
        } else {
          shares = trade.suggestedAmount / trade.currentPrice;
        }

        // GTC limit orders with user-configured slippage for reliable fills.
        // FOK orders fail when orderbook lacks sufficient liquidity at exact price.
        const slippage = (trade.slippagePct || 10) / 100;
        const apiKey = decrypt(user.clob_api_key);
        const apiSecret = decrypt(user.clob_api_secret);
        const apiPassphrase = decrypt(user.clob_api_passphrase);

        let result: any;
        const tSubmit = Date.now();

        if (trade.side === 'SELL') {
          // GTC limit sell — accept up to user's sell tolerance below current price.
          // `shares` already set above from position lookup (full exit).
          const limitPrice = Math.max(
            Math.floor(trade.currentPrice * (1 - slippage) * 100) / 100,
            0.01,
          );
          const signedOrder = await clobClient.createOrder({
            tokenID: trade.tokenId,
            price: limitPrice,
            size: Math.floor(shares * 100) / 100,
            side: trade.side,
          });

          result = await submitOrderToCLOB({
            signedOrder,
            apiKey,
            apiSecret,
            apiPassphrase,
            walletAddress: polyAddress,
          });
        } else {
          // GTC limit buy — pay up to user's buy tolerance above current price.
          const limitPrice = Math.min(
            Math.ceil(trade.currentPrice * (1 + slippage) * 100) / 100,
            0.99,
          );
          // Recalculate shares at worst-case price to stay within budget.
          shares = Math.floor((trade.suggestedAmount / limitPrice) * 100) / 100;
          const signedOrder = await clobClient.createOrder({
            tokenID: trade.tokenId,
            price: limitPrice,
            size: shares,
            side: trade.side,
          });

          result = await submitOrderToCLOB({
            signedOrder,
            apiKey,
            apiSecret,
            apiPassphrase,
            walletAddress: polyAddress,
          });
        }

        console.log(`[processor] phase=clob_submit user=${trade.userWallet.slice(0, 10)} side=${trade.side} ok=${result.ok} duration_ms=${Date.now() - tSubmit}`);

        if (result.ok) {
          const orderId = result.data.orderID || result.data.id || JSON.stringify(result.data);

          const actualAmount = trade.side === 'SELL'
            ? Math.round(shares * trade.currentPrice * 100) / 100
            : trade.suggestedAmount;

          // Finalize the pending claim → executed
          await finalizeSignalClaim(sb, claimId!, {
            status: 'executed',
            order_id: typeof orderId === 'string' ? orderId : JSON.stringify(orderId),
            amount: actualAmount,
            price: trade.currentPrice,
          });

          // Log to ep_user_trades (with per-trade SL/TP if configured on the follow)
          const follow = allFollows.find((f) => f.id === trade.followId);
          const tradeRecord: Record<string, any> = {
            user_wallet: trade.userWallet,
            token_id: trade.tokenId,
            side: trade.side,
            direction: trade.direction,
            amount: actualAmount,
            price: trade.currentPrice,
            shares,
            order_id: typeof orderId === 'string' ? orderId : JSON.stringify(orderId),
            source: 'copytrade',
            source_id: trade.signalId,
            market_slug: trade.marketId,
          };
          // Set per-trade SL/TP as absolute price targets (the monitor checks these)
          if (trade.side === 'BUY' && follow) {
            if (follow.stop_loss_pct) {
              tradeRecord.stop_loss = Math.max(trade.currentPrice * (1 - follow.stop_loss_pct / 100), 0.01);
            }
            if (follow.take_profit_pct) {
              tradeRecord.take_profit = Math.min(trade.currentPrice * (1 + follow.take_profit_pct / 100), 0.99);
            }
          }
          await sb.from('ep_user_trades').insert(tradeRecord);

          // Update total_spent on follow (only for buys — sells return money)
          if (trade.side === 'BUY' && follow) {
            const newSpent = (parseFloat(follow.total_spent) || 0) + trade.suggestedAmount;
            await sb.from('ep_user_follows')
              .update({ total_spent: newSpent })
              .eq('id', trade.followId);
          }

          // Update in-batch daily count so subsequent trades in this batch respect limits
          if (!batchDailyCounts.has(trade.userWallet)) batchDailyCounts.set(trade.userWallet, new Map());
          const btc = batchDailyCounts.get(trade.userWallet)!;
          btc.set(trade.traderId, (btc.get(trade.traderId) || 0) + 1);

          executed++;
          tradeTimings.push(Date.now() - tTrade);
          const exitLabel = trade.side === 'SELL' ? `SELL ${shares.toFixed(1)} shares` : `$${actualAmount}`;
          console.log(
            `[copytrade] EXECUTED: ${trade.traderAlias} → ${trade.userWallet.slice(0, 8)} ` +
            `${exitLabel} ${trade.direction} on ${trade.marketQuestion.slice(0, 40)}`,
          );
        } else {
          const isGeoblock = result.status === 403;
          const errMsg = isGeoblock
            ? `CLOB 403 (geoblock) — proxy IP may be blocked: ${JSON.stringify(result.data).slice(0, 200)}`
            : `CLOB ${result.status}: ${JSON.stringify(result.data).slice(0, 200)}`;

          // Finalize the pending claim → failed (frees the signal for retry)
          await finalizeSignalClaim(sb, claimId!, {
            status: 'failed',
            amount: trade.suggestedAmount,
            price: trade.currentPrice,
            error_message: errMsg,
          });
          failed++;
          tradeTimings.push(Date.now() - tTrade);
          console.error(`[copytrade] FAILED: ${errMsg}`);
        }
      } catch (err: any) {
        // Finalize the pending claim → failed (if we got a claimId)
        if (claimId) {
          await finalizeSignalClaim(sb, claimId, {
            status: 'failed',
            error_message: `Execution error: ${err.message?.slice(0, 200)}`,
          });
        } else {
          await logActivity(sb, {
            user_wallet: trade.userWallet,
            signal_id: trade.signalId,
            trader_id: trade.traderId,
            status: 'failed',
            market_slug: trade.marketId,
            market_question: trade.marketQuestion,
            direction: trade.direction,
            trader_alias: trade.traderAlias,
            error_message: `Execution error: ${err.message?.slice(0, 200)}`,
          });
        }
        failed++;
        tradeTimings.push(Date.now() - tTrade);
        console.error(`[copytrade] ERROR for ${trade.userWallet.slice(0, 8)}:`, err.message);
      }
    }

    // ── 9. Notify manual-mode users ──────────────────
    let notified = 0;
    for (const trade of manualTrades) {
      try {
        // Send in-app notification
        await sb.from('ep_notifications').insert({
          user_wallet: trade.userWallet,
          type: 'signal',
          title: `${trade.traderAlias} traded ${trade.direction}`,
          body: `$${trade.suggestedAmount} ${trade.direction} on ${trade.marketQuestion.slice(0, 60)} at ${(trade.currentPrice * 100).toFixed(0)}c`,
          metadata: {
            signalId: trade.signalId,
            traderId: trade.traderId,
            traderAlias: trade.traderAlias,
            marketId: trade.marketId,
            marketQuestion: trade.marketQuestion,
            direction: trade.direction,
            suggestedAmount: trade.suggestedAmount,
            currentPrice: trade.currentPrice,
            action: 'review_trade',
          },
          read: false,
        });

        // Log as skipped for dedup (prevents re-notification on next run)
        await logActivity(sb, {
          user_wallet: trade.userWallet,
          signal_id: trade.signalId,
          trader_id: trade.traderId,
          status: 'skipped',
          market_slug: trade.marketId,
          market_question: trade.marketQuestion,
          direction: trade.direction,
          trader_alias: trade.traderAlias,
          error_message: 'Manual mode — user notified',
        });

        notified++;
      } catch (err) {
        console.warn('Failed to notify manual user:', trade.userWallet, err);
      }
    }

    const totalMs = Date.now() - tProcessorStart;
    const avgTradeMs = tradeTimings.length > 0
      ? Math.round(tradeTimings.reduce((a, b) => a + b, 0) / tradeTimings.length)
      : 0;
    console.log(`[processor] phase=complete total_ms=${totalMs} trades_executed=${executed} trades_failed=${failed} trades_skipped=${skipped} trades_notified=${notified} avg_per_trade_ms=${avgTradeMs}`);

    return NextResponse.json({
      executed, notified, skipped, failed,
      proxyEnabled: hasProxy,
      _debug: {
        follows: allFollows.length,
        signals: signals?.length || 0,
        autoTrades: autoTrades.length,
        manualTrades: manualTrades.length,
        slippageSkipped: allPending.length - afterSlippage.length,
        skipReasons,
        followSlippage: allFollows.map((f) => ({
          trader: f.trader_id.slice(0, 8),
          buy: f.slippage_buy_pct,
          sell: f.slippage_sell_pct,
        })),
      },
    });
  } catch (err: any) {
    console.error('Copytrade processor error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
