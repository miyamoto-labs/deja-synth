import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/rising-stars
 *
 * Finds up-and-coming traders with exceptional stats from small bankrolls.
 * Filters out likely bots using heuristics:
 *   - Bots trade 24/7 on ultra-short markets (5m/15m BTC/ETH up/down)
 *   - Bots have very uniform position sizes
 *   - Bots have very high trade counts relative to time
 *   - Bots trade only on a single market category
 *
 * Query params:
 *   limit — max results (default: 10, max: 20)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 20);

    const sb = getSupabase();

    // Fetch small + micro tier traders with good stats
    // Also include mid tiers with exceptional win rates
    const { data: traders, error } = await sb
      .from("ep_tracked_traders")
      .select("*")
      .eq("active", true)
      .in("bankroll_tier", ["micro", "small", "mid"])
      .gte("win_rate", 55) // At least 55% win rate
      .gte("trade_count", 5) // At least 5 trades (enough sample)
      .order("roi", { ascending: false })
      .limit(100); // Fetch more, then filter bots

    if (error) {
      console.error("Rising stars query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = traders || [];

    // ── Bot Detection Heuristics ──────────────────────────
    const filtered = rows.filter((t: any) => {
      // 1. Skip traders with suspiciously high trade counts (>200 trades = likely bot)
      if ((t.trade_count || 0) > 200) return false;

      // 2. Skip traders with aliases that look like bot-generated hex addresses
      const alias = (t.alias || "").toLowerCase();
      if (/^0x[a-f0-9]{8,}$/.test(alias)) {
        // Pure hex address with high trades = likely bot
        if ((t.trade_count || 0) > 50) return false;
      }

      // 3. Skip traders that only trade on ultra-short duration markets
      // (BTC/ETH 5m/15m up-down markets are prime bot territory)
      // We can detect this from the alias pattern or recent trades
      if (alias.includes("updown") || alias.includes("up-down")) return false;

      // 4. Skip traders with 100% win rate and many trades (too good = bot)
      if ((t.win_rate || 0) >= 99 && (t.trade_count || 0) > 15) return false;

      // 5. Skip if ROI is negative (we want rising stars)
      if ((t.roi || 0) <= 0) return false;

      // 6. Must have traded in at least 2 markets (bots often stick to 1)
      if ((t.markets_traded || 0) < 2) return false;

      return true;
    });

    // ── Star Score ─────────────────────────────────────────
    // Composite score that rewards:
    // - High ROI from small bankroll (underdog factor)
    // - Solid win rate
    // - Reasonable trade count (consistent, not a one-hit wonder)
    // - Multiple markets (diversified skill)
    const scored = filtered.map((t: any) => {
      const underdogBonus =
        t.bankroll_tier === "micro" ? 2.0 : t.bankroll_tier === "small" ? 1.5 : 1.0;

      const roiScore = Math.min((t.roi || 0) / 100, 5); // Cap at 500% ROI contribution
      const winScore = ((t.win_rate || 0) - 50) / 50; // 0-1 scale above 50%
      const consistencyScore = Math.min((t.trade_count || 0) / 30, 1); // Rewards up to 30 trades
      const diversityScore = Math.min((t.markets_traded || 0) / 5, 1); // Rewards up to 5 markets

      const starScore =
        (roiScore * 0.35 + winScore * 0.25 + consistencyScore * 0.2 + diversityScore * 0.2) *
        underdogBonus;

      return { ...t, star_score: Math.round(starScore * 100) / 100 };
    });

    // Sort by star score and take top N
    scored.sort((a: any, b: any) => b.star_score - a.star_score);
    const stars = scored.slice(0, limit);

    // Summary stats
    const avgRoi = stars.length > 0
      ? stars.reduce((s: number, t: any) => s + (t.roi || 0), 0) / stars.length
      : 0;
    const avgWinRate = stars.length > 0
      ? stars.reduce((s: number, t: any) => s + (t.win_rate || 0), 0) / stars.length
      : 0;

    return NextResponse.json(
      {
        stars,
        total: stars.length,
        avg_roi: Math.round(avgRoi * 10) / 10,
        avg_win_rate: Math.round(avgWinRate * 10) / 10,
        filtered_bots: rows.length - filtered.length,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=120, stale-while-revalidate=300",
        },
      }
    );
  } catch (err: any) {
    console.error("Rising stars API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
