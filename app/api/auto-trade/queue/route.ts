import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';

export const dynamic = 'force-dynamic';

const GAMMA_API = 'https://gamma-api.polymarket.com';

/**
 * GET /api/auto-trade/queue?wallet=0x...
 *
 * Returns pending trade signals for the user — signals from
 * followed traders (auto + manual mode) that haven't been executed
 * or dismissed yet. Respects daily trade limits.
 * Manual-mode signals include `manual: true` flag.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet')?.toLowerCase();

    if (!wallet) {
      return NextResponse.json(
        { error: 'Missing wallet query parameter' },
        { status: 400 }
      );
    }

    const sb = getSupabase();

    // ── 1. Get user's active follows (auto + manual) ──
    const { data: rawFollows, error: followsErr } = await sb
      .from('ep_user_follows')
      .select('trader_id, amount_per_trade, max_daily_trades, copy_buy, copy_sell, sizing_mode, sizing_value, min_trade_size, max_per_trade, total_spend_limit, total_spent, auto_trade')
      .eq('user_wallet', wallet)
      .eq('active', true);

    if (followsErr) throw followsErr;

    const follows = rawFollows || [];

    if (follows.length === 0) {
      return NextResponse.json({ pendingTrades: [], stats: { dailyUsed: 0, dailyLimit: 0 } });
    }

    const traderIds = follows.map((f: any) => f.trader_id);
    const followMap = Object.fromEntries(
      follows.map((f: any) => [f.trader_id, f])
    );

    // ── 2. Get today's auto-trade executions ────────
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: todayLogs } = await sb
      .from('ep_auto_trade_log')
      .select('signal_id, trader_id, status, error_message')
      .eq('user_wallet', wallet)
      .gte('created_at', todayStart.toISOString());

    // Only treat actually-executed signals as "done" — not pending, failed, or manual-skipped.
    // Manual signals (error_message = 'Manual mode — user notified') stay in the queue
    // so the user can click "Trade $X" to execute them.
    // Pending/failed signals should also remain visible (they weren't successfully traded).
    const executedSignalIds = new Set(
      (todayLogs || [])
        .filter((l: any) => l.status === 'executed')
        .map((l: any) => l.signal_id)
    );

    // Daily usage only counts actually executed trades
    const executedLogs = (todayLogs || []).filter((l: any) => l.status === 'executed');
    const dailyUsed = executedLogs.length;

    // Count per-trader daily usage (executed only — not skipped/manual/failed)
    const traderDailyCount: Record<string, number> = {};
    for (const log of executedLogs) {
      traderDailyCount[log.trader_id] = (traderDailyCount[log.trader_id] || 0) + 1;
    }

    // ── 3. Get dismissed signals ────────────────────
    const { data: dismissed } = await sb
      .from('ep_auto_trade_dismissed')
      .select('signal_id')
      .eq('user_wallet', wallet);

    const dismissedIds = new Set((dismissed || []).map((d: any) => d.signal_id));

    // ── 4. Get recent signals from followed traders ─
    // Look back 24 hours for signals
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: signals, error: signalsErr } = await sb
      .from('ep_trader_trades')
      .select('*, ep_tracked_traders(alias, wallet_address, roi, win_rate, bankroll_tier, trading_style)')
      .in('trader_id', traderIds)
      .gte('timestamp', cutoff)
      .order('timestamp', { ascending: false })
      .limit(50);

    if (signalsErr) throw signalsErr;

    // ── 5. Filter out executed + dismissed signals + respect new settings ──
    const pendingRaw = (signals || []).filter((s: any) => {
      if (executedSignalIds.has(s.id)) return false;
      if (dismissedIds.has(s.id)) return false;

      const follow = followMap[s.trader_id];
      if (!follow) return false;

      // Check per-trader daily limit
      const used = traderDailyCount[s.trader_id] || 0;
      if (used >= follow.max_daily_trades) return false;

      // Copy direction filter: copy_buy = copy entries, copy_sell = copy exits.
      // Direction (YES/NO) indicates which outcome, NOT buy vs sell.
      // A trader can BUY NO shares (entry) or SELL YES shares (exit).
      const isEntry = s.trade_type === 'entry';
      const isExit = s.trade_type === 'exit';
      if (isEntry && follow.copy_buy === false) return false;
      if (isExit && follow.copy_sell === false) return false;

      // Min trade size filter
      if (follow.min_trade_size && s.amount < follow.min_trade_size) return false;

      // Total spend limit check
      if (follow.total_spend_limit && (parseFloat(follow.total_spent) || 0) >= follow.total_spend_limit) return false;

      return true;
    });

    // ── 6. Enrich with market data ──────────────────
    const marketIds = Array.from(new Set(pendingRaw.map((s: any) => s.market_id)));
    let marketsMap: Record<string, any> = {};
    if (marketIds.length > 0) {
      const { data: markets } = await sb
        .from('ep_markets_raw')
        .select('market_id, question, category, yes_price, no_price, yes_token, no_token')
        .in('market_id', marketIds);

      for (const m of markets || []) {
        marketsMap[m.market_id] = m;
      }

      // Gamma API fallback for markets not in ep_markets_raw (e.g. sports markets)
      const missingSlugs = marketIds.filter(
        (id) => !marketsMap[id] || !marketsMap[id].yes_token || !marketsMap[id].no_token,
      );
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

              let outcomes: string[] = ['Yes', 'No'];
              try {
                const raw = gm.outcomes || '["Yes","No"]';
                outcomes = typeof raw === 'string' ? JSON.parse(raw) : raw;
              } catch { /* skip */ }

              let yesPrice = 0;
              let noPrice = 0;
              try {
                const prices = JSON.parse(gm.outcomePrices || '[]');
                if (prices.length >= 2) {
                  yesPrice = parseFloat(prices[0]);
                  noPrice = parseFloat(prices[1]);
                }
              } catch { /* skip */ }

              return {
                market_id: slug,
                question: gm.question || slug,
                category: gm.groupItemTitle || '',
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
          marketsMap[gm.market_id] = { ...marketsMap[gm.market_id], ...gm };
        }
      }
    }

    // ── 7. Format response ──────────────────────────
    const totalDailyLimit = follows.reduce(
      (sum: number, f: any) => sum + (f.max_daily_trades || 5),
      0
    );

    const pendingTrades = pendingRaw.map((s: any) => {
      const { ep_tracked_traders, ...rest } = s;
      const market = marketsMap[s.market_id];
      const follow = followMap[s.trader_id];

      // Calculate suggested amount based on sizing mode
      // Polymarket CLOB minimum order size is 5 shares — $5 floor prevents rejected orders.
      const CLOB_MIN_AMOUNT = 5;
      let suggestedAmount: number;
      if (follow?.sizing_mode === 'percentage') {
        suggestedAmount = Math.round(((s.amount || 0) * (follow.sizing_value || 10)) / 100);
        if (follow.max_per_trade && suggestedAmount > follow.max_per_trade) {
          suggestedAmount = follow.max_per_trade;
        }
        suggestedAmount = Math.max(suggestedAmount, CLOB_MIN_AMOUNT);
      } else {
        suggestedAmount = Math.max(follow?.amount_per_trade || 10, CLOB_MIN_AMOUNT);
      }

      return {
        signalId: s.id,
        traderId: s.trader_id,
        traderAlias: ep_tracked_traders?.alias || 'Unknown',
        traderRoi: ep_tracked_traders?.roi || 0,
        traderWinRate: ep_tracked_traders?.win_rate || 0,
        traderTier: ep_tracked_traders?.bankroll_tier || '',
        traderStyle: ep_tracked_traders?.trading_style || '',
        marketId: s.market_id,
        marketQuestion: market?.question || s.market_id,
        marketCategory: market?.category || '',
        direction: s.direction || 'YES',
        traderAmount: s.amount || 0,
        traderPrice: s.price || 0,
        currentYesPrice: market?.yes_price || 0,
        currentNoPrice: market?.no_price || 0,
        yesToken: market?.yes_token || '',
        noToken: market?.no_token || '',
        suggestedAmount,
        sizingMode: follow?.sizing_mode || 'fixed',
        sizingValue: follow?.sizing_mode === 'percentage' ? (follow?.sizing_value || 10) : (follow?.amount_per_trade || 10),
        maxPerTrade: follow?.max_per_trade || 0,
        timestamp: s.timestamp || s.created_at,
        manual: follow?.auto_trade === false,
      };
    });

    return NextResponse.json({
      pendingTrades,
      stats: {
        dailyUsed,
        dailyLimit: totalDailyLimit,
      },
    });
  } catch (err: any) {
    console.error('Auto-trade queue error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch auto-trade queue' },
      { status: 500 }
    );
  }
}
