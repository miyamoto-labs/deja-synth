import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase-server";

export const revalidate = 60;

export async function GET() {
  try {
    const sb = getSupabase();

    // Engine v2 deployed 2025-02-17 — filter out v1 garbage data
    const V2_CUTOFF = "2025-02-17T00:00:00Z";

    // Get pick results for performance stats (v2 only)
    const { data: results, error: resultsErr } = await sb
      .from("ep_pick_results")
      .select("*")
      .gte("resolved_at", V2_CUTOFF)
      .order("resolved_at", { ascending: false });

    if (resultsErr) {
      console.error("Results query error:", resultsErr);
    }

    // Get all picks for status breakdown (v2 only)
    const { data: picks } = await sb
      .from("ep_curated_picks")
      .select("status, conviction_score, direction, time_horizon, created_at")
      .gte("created_at", V2_CUTOFF);

    const rows = results || [];
    const allPicks = picks || [];

    // Calculate stats
    const wins = rows.filter((r) => r.pnl_absolute > 0);
    const losses = rows.filter((r) => r.pnl_absolute <= 0);
    const totalPnl = rows.reduce((s, r) => s + (r.pnl_absolute || 0), 0);
    const avgPnl = rows.length > 0 ? totalPnl / rows.length : 0;

    // Status breakdown
    const active = allPicks.filter((p) => p.status === "active").length;
    const closed = allPicks.filter((p) => p.status !== "active").length;

    // Average conviction score
    const avgConviction =
      allPicks.length > 0
        ? allPicks.reduce((s, p) => s + (p.conviction_score || 0), 0) / allPicks.length
        : 0;

    return NextResponse.json(
      {
        total_picks: allPicks.length,
        active_picks: active,
        closed_picks: closed,
        total_results: rows.length,
        wins: wins.length,
        losses: losses.length,
        win_rate: rows.length > 0 ? Math.round((wins.length / rows.length) * 1000) / 10 : 0,
        total_pnl: Math.round(totalPnl * 100) / 100,
        avg_pnl: Math.round(avgPnl * 100) / 100,
        avg_conviction: Math.round(avgConviction * 10) / 10,
        recent_results: rows.slice(0, 10),
      },
      {
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (err: any) {
    console.error("Performance API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
