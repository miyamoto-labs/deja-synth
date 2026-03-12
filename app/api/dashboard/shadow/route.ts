import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase-server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * GET /api/dashboard/shadow?walletAddress=0x...
 * Personal copy-trade dashboard: returns ONLY the user's followed traders
 * with full settings, recent signals, and personal stats.
 */
export async function GET(request: Request) {
  try {
    const sb = getSupabase();
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("walletAddress")?.toLowerCase();

    // No wallet = empty dashboard
    if (!walletAddress) {
      return NextResponse.json({
        traders: [],
        signals: [],
        stats: { total_copied: 0, active_count: 0, total_spent: 0, daily_budget: 0 },
      });
    }

    // 1. Get active user follows with full settings (inactive = removed)
    const { data: follows, error: followsErr } = await sb
      .from("ep_user_follows")
      .select("*")
      .eq("user_wallet", walletAddress)
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (followsErr) throw followsErr;

    if (!follows || follows.length === 0) {
      return NextResponse.json({
        traders: [],
        signals: [],
        stats: { total_copied: 0, active_count: 0, total_spent: 0, daily_budget: 0 },
      });
    }

    // 2. Get trader details for all followed traders
    const traderIds = follows.map((f: any) => f.trader_id);
    const { data: traders } = await sb
      .from("ep_tracked_traders")
      .select("*")
      .in("id", traderIds);

    // 3. Merge follow settings into trader objects
    const traderMap = new Map((traders || []).map((t: any) => [t.id, t]));
    const enriched = follows
      .map((f: any) => {
        const trader = traderMap.get(f.trader_id);
        if (!trader) return null;
        return { ...trader, follow: f };
      })
      .filter(Boolean);

    // 4. Get recent signals ONLY from followed traders (last 24h)
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: trades } = await sb
      .from("ep_trader_trades")
      .select("*, ep_tracked_traders(alias, wallet_address, roi, win_rate, bankroll_tier, trading_style)")
      .in("trader_id", traderIds)
      .gte("timestamp", cutoff24h)
      .order("timestamp", { ascending: false })
      .limit(50);

    // 5. Enrich trades with market data
    const marketIds = Array.from(new Set((trades || []).map((t: any) => t.market_id)));
    let marketsMap: Record<string, any> = {};
    if (marketIds.length > 0) {
      const { data: markets } = await sb
        .from("ep_markets_raw")
        .select("market_id, question, category, yes_price, no_price, yes_token, no_token")
        .in("market_id", marketIds);

      for (const m of markets || []) {
        marketsMap[m.market_id] = m;
      }
    }

    const enrichedSignals = (trades || []).map((t: any) => {
      const { ep_tracked_traders, ...rest } = t;
      return {
        ...rest,
        trader: ep_tracked_traders || null,
        market: marketsMap[t.market_id] || null,
      };
    });

    // 6. Personal stats (all returned follows are active since we filter above)
    const activeCount = follows.filter((f: any) => f.auto_trade).length;
    const totalSpent = follows.reduce((s: number, f: any) => s + (parseFloat(f.total_spent) || 0), 0);
    // Daily budget: for fixed mode, use amount_per_trade × max_daily.
    // For percentage mode, we can't know exact exposure, so show "Variable" via null.
    let dailyBudget: number | null = 0;
    let hasVariableBudget = false;
    for (const f of follows.filter((f: any) => f.auto_trade)) {
      const maxDaily = f.max_daily_trades || 5;
      if (f.sizing_mode === 'percentage') {
        hasVariableBudget = true;
        // Use max_per_trade as upper bound if set, otherwise mark as variable
        if (f.max_per_trade) {
          dailyBudget = (dailyBudget || 0) + (f.max_per_trade * maxDaily);
        } else {
          dailyBudget = null; // Can't calculate — truly variable
        }
      } else if (dailyBudget !== null) {
        dailyBudget += (f.amount_per_trade || 10) * maxDaily;
      }
    }

    return NextResponse.json(
      {
        traders: enriched,
        signals: enrichedSignals,
        stats: {
          total_copied: follows.length,
          active_count: activeCount,
          total_spent: Math.round(totalSpent * 100) / 100,
          daily_budget: dailyBudget !== null ? Math.round(dailyBudget) : null,
          daily_budget_variable: hasVariableBudget,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err: any) {
    console.error("Shadow API error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch shadow data" },
      { status: 500 }
    );
  }
}
