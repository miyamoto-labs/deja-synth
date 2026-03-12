import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase-server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * GET /api/dashboard/traders
 * Query params:
 *   tier   — bankroll tier filter: micro | small | mid | whale | all (default: all)
 *   style  — trading style filter: degen | sniper | grinder | whale | all (default: all)
 *   sort   — sort field: gem | roi | win_rate | total_pnl | composite_rank (default: gem)
 *   source — source filter: user_added | scanner | all (default: all)
 *   limit  — max results (default: 200, max: 500)
 *   view   — view mode: copy (default, copyable traders sorted by gem) | whales (PnL > $1M sorted by PnL)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "500"), 500);
    const tier = searchParams.get("tier") || "all";
    const style = searchParams.get("style") || "all";
    const sort = searchParams.get("sort") || "gem";  // Default to gem score (best copyable traders first)
    const source = searchParams.get("source") || "all";
    const category = searchParams.get("category") || "all";
    const view = searchParams.get("view") || "copy";

    const sb = getSupabase();

    // Build query — traders are curated, so only filter by active status
    let query = sb
      .from("ep_tracked_traders")
      .select("*")
      .eq("active", true);

    // View-based filtering
    if (view === "whales") {
      // Whale Movements: high PnL traders, sorted by total_pnl
      query = query.gt("total_pnl", 1000000);
    } else {
      // Copy Traders (default): only copyable traders with real activity
      query = query.eq("copyable", true);
    }

    // Filter by source
    if (source === "user_added") {
      query = query.eq("source", "user_added");
    } else if (source === "scanner") {
      query = query.or("source.is.null,source.neq.user_added");
    }

    // Filter by bankroll tier
    if (tier && tier !== "all") {
      query = query.eq("bankroll_tier", tier);
    }

    // Filter by trading style
    if (style && style !== "all") {
      query = query.eq("trading_style", style);
    }

    // Filter by category
    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    // Sort — gem score is computed at runtime, others are DB columns
    // Whales view defaults to total_pnl sort
    const effectiveSort = view === "whales" && sort === "gem" ? "total_pnl" : sort;
    if (effectiveSort !== "gem") {
      const sortMap: Record<string, string> = {
        roi: "roi",
        win_rate: "win_rate",
        total_pnl: "total_pnl",
        composite_rank: "composite_rank",
      };
      const sortCol = sortMap[effectiveSort] || "roi";
      query = query.order(sortCol, { ascending: false });
    } else {
      // For gem sort, fetch all and sort in-memory
      query = query.order("composite_rank", { ascending: false });
    }
    query = query.limit(limit);

    const { data: traders, error: tradersErr } = await query;

    if (tradersErr) {
      console.error("Traders query error:", tradersErr);
      return NextResponse.json({ error: tradersErr.message }, { status: 500 });
    }

    // Get recent trades for these traders (last 100 trades)
    const { data: trades } = await sb
      .from("ep_trader_trades")
      .select("*, ep_markets_raw(question, yes_price, no_price)")
      .order("created_at", { ascending: false })
      .limit(100);

    // Group trades by trader_id and rename ep_markets_raw → market
    const tradesByTrader: Record<string, any[]> = {};
    for (const trade of trades || []) {
      const { ep_markets_raw, ...rest } = trade;
      const cleanTrade = { ...rest, market: ep_markets_raw || null };
      if (!tradesByTrader[cleanTrade.trader_id]) {
        tradesByTrader[cleanTrade.trader_id] = [];
      }
      tradesByTrader[cleanTrade.trader_id].push(cleanTrade);
    }

    // Compute gem score for each trader
    function computeGemScore(t: any): number {
      const roi = t.roi || 0;
      const tradeCount = t.trade_count || 0;
      const marketsTrd = t.markets_traded || 0;
      const volume = t.estimated_bankroll || 0;

      // Parse consistency from profile_summary JSON metadata
      let consistency = 0;
      if (t.profile_summary) {
        try {
          const meta = JSON.parse(t.profile_summary);
          consistency = meta.consistency_score || 0;
        } catch { /* not JSON, ignore */ }
      }

      const roiNorm = Math.min(roi / 200, 1.0);
      const consistencyNorm = consistency / 100;
      const activityNorm = Math.min(tradeCount / 500, 1.0);
      const diversityNorm = Math.min(marketsTrd / 50, 1.0);
      const copyability = volume < 100_000 ? 1.0 : volume < 1_000_000 ? 0.8 : 0.6;

      return (
        roiNorm * 0.25 +
        consistencyNorm * 0.25 +
        activityNorm * 0.20 +
        diversityNorm * 0.15 +
        copyability * 0.15
      );
    }

    // Assign gem_score and gem_tier
    const withGem = (traders || []).map((t: any) => {
      const gem = computeGemScore(t);
      return { ...t, gem_score: Math.round(gem * 1000) / 1000 };
    });

    // Compute gem tier thresholds from the full set
    const gemScores = withGem.map((t: any) => t.gem_score).sort((a: number, b: number) => b - a);
    const diamondThreshold = gemScores[Math.floor(gemScores.length * 0.1)] || 0;
    const goldThreshold = gemScores[Math.floor(gemScores.length * 0.25)] || 0;
    const silverThreshold = gemScores[Math.floor(gemScores.length * 0.5)] || 0;

    const withTiers = withGem.map((t: any) => ({
      ...t,
      gem_tier: t.gem_score >= diamondThreshold ? "diamond"
        : t.gem_score >= goldThreshold ? "gold"
        : t.gem_score >= silverThreshold ? "silver"
        : "bronze",
    }));

    // Sort by gem_score if gem sort selected
    let sortedTraders = withTiers;
    if (effectiveSort === "gem") {
      sortedTraders = [...withTiers].sort((a: any, b: any) => b.gem_score - a.gem_score);
    }

    // Enrich traders with their trades
    const enriched = sortedTraders.map((t: any) => ({
      ...t,
      recent_trades: (tradesByTrader[t.id] || []).slice(0, 5),
    }));

    // Summary stats (for the filtered set)
    const tradersList = traders || [];
    const totalPnl = tradersList.reduce((s: number, t: any) => s + (t.total_pnl || 0), 0);
    const avgRoi = tradersList.length > 0
      ? tradersList.reduce((s: number, t: any) => s + (t.roi || 0), 0) / tradersList.length
      : 0;
    const avgWinRate = tradersList.length > 0
      ? tradersList.reduce((s: number, t: any) => s + (t.win_rate || 0), 0) / tradersList.length
      : 0;

    // Top performer (highest ROI in filtered set)
    const topPerformer = tradersList.length > 0
      ? tradersList.reduce((best: any, t: any) => (t.roi || 0) > (best.roi || 0) ? t : best, tradersList[0])
      : null;

    // Tier breakdown
    const tierBreakdown: Record<string, number> = {};
    for (const t of tradersList) {
      const bt = t.bankroll_tier || "unknown";
      tierBreakdown[bt] = (tierBreakdown[bt] || 0) + 1;
    }

    // Style breakdown
    const styleBreakdown: Record<string, number> = {};
    for (const t of tradersList) {
      const ts = t.trading_style || "unknown";
      styleBreakdown[ts] = (styleBreakdown[ts] || 0) + 1;
    }

    return NextResponse.json(
      {
        traders: enriched,
        total_traders: tradersList.length,
        total_tracked_pnl: Math.round(totalPnl),
        avg_roi: Math.round(avgRoi * 10) / 10,
        avg_win_rate: Math.round(avgWinRate * 10) / 10,
        top_performer: topPerformer ? {
          alias: topPerformer.alias,
          roi: topPerformer.roi,
          tier: topPerformer.bankroll_tier,
        } : null,
        tier_breakdown: tierBreakdown,
        style_breakdown: styleBreakdown,
        total_signals: trades?.length || 0,
        filters: { tier, style, sort, view },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err: any) {
    console.error("Traders API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
