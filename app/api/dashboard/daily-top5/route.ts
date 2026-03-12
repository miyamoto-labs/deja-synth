import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase-server";

// Force dynamic to bust stale ISR cache, then switch back to revalidate
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * GET /api/dashboard/daily-top5
 *
 * EasyPoly's weekly recommended gem traders to copy.
 * Uses gem scoring (consistency, activity, ROI efficiency, copyability)
 * with tier diversity to surface the best traders to follow this week.
 */
export async function GET() {
  try {
    const sb = getSupabase();

    // Fetch all active traders with meaningful data
    const { data: traders, error } = await sb
      .from("ep_tracked_traders")
      .select("*")
      .eq("active", true)
      .gt("composite_rank", 0)
      .gte("trade_count", 10)
      .order("composite_rank", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Weekly top 5 query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = traders || [];

    // Filter: must be profitable
    const filtered = rows.filter((t: any) => (t.roi || 0) > 0);

    // ── Gem Scoring: "Best to copy this week" ──
    // Surfaces consistent, active, efficient, copyable traders
    const scored = filtered.map((t: any) => {
      const roi = t.roi || 0;
      const tradeCount = t.trade_count || 0;
      const marketsTrd = t.markets_traded || 0;
      const volume = t.estimated_bankroll || 0;
      const winRate = t.win_rate || 0;

      // Parse consistency from profile_summary metadata
      let consistency = 0;
      if (t.profile_summary) {
        try {
          const meta = JSON.parse(t.profile_summary);
          consistency = meta.consistency_score || 0;
        } catch { /* not JSON */ }
      }

      const roiNorm = Math.min(roi / 200, 1.0);
      const consistencyNorm = consistency / 100;
      const activityNorm = Math.min(tradeCount / 500, 1.0);
      const diversityNorm = Math.min(marketsTrd / 50, 1.0);
      const copyability = volume < 100_000 ? 1.0 : volume < 1_000_000 ? 0.8 : 0.6;

      const gemScore =
        roiNorm * 0.25 +
        consistencyNorm * 0.25 +
        activityNorm * 0.20 +
        diversityNorm * 0.15 +
        copyability * 0.15;

      // Generate pick reason highlighting gem qualities
      let pickReason = "";
      if (consistency >= 95 && tradeCount >= 100) {
        pickReason = `Ultra-consistent: ${tradeCount} trades across ${marketsTrd} markets`;
      } else if (marketsTrd >= 50) {
        pickReason = `Highly diversified: ${marketsTrd} markets, ${winRate.toFixed(0)}% win rate`;
      } else if (tradeCount >= 200 && roi >= 20) {
        pickReason = `Active gem: ${tradeCount} trades with ${roi.toFixed(0)}% ROI`;
      } else if (volume < 100_000 && roi >= 50) {
        pickReason = `Hidden gem: ${roi.toFixed(0)}% ROI on ${tradeCount} trades`;
      } else if (winRate >= 80) {
        pickReason = `Sharp eye: ${winRate.toFixed(0)}% win rate across ${marketsTrd} markets`;
      } else {
        pickReason = `Solid performer: ${roi.toFixed(0)}% ROI, ${tradeCount} trades`;
      }

      return {
        ...t,
        pick_score: Math.round(gemScore * 10000) / 100,
        gem_score: Math.round(gemScore * 1000) / 1000,
        pick_reason: pickReason,
      };
    });

    // Sort by gem score
    scored.sort((a: any, b: any) => b.gem_score - a.gem_score);

    // ── Tier Diversity: ensure mix of tiers ──
    const top5: any[] = [];
    const tierCounts: Record<string, number> = {};
    const bigTiers = new Set(["whale", "mid"]);
    const smallTiers = new Set(["small", "micro"]);
    let hasBig = false;
    let hasSmall = false;

    for (const t of scored) {
      if (top5.length >= 5) break;
      const tier = t.bankroll_tier || "unknown";
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;

      // Allow max 2 from same tier
      if (tierCounts[tier] > 2) continue;

      // If we have 4 and no small tier yet, force one
      if (top5.length === 4 && !hasSmall && smallTiers.has(tier)) {
        top5.push(t);
        hasSmall = true;
        continue;
      }
      if (top5.length === 4 && !hasBig && bigTiers.has(tier)) {
        top5.push(t);
        hasBig = true;
        continue;
      }

      top5.push(t);
      if (bigTiers.has(tier)) hasBig = true;
      if (smallTiers.has(tier)) hasSmall = true;
    }

    // Backfill if needed
    if (top5.length < 5) {
      for (const t of scored) {
        if (top5.length >= 5) break;
        if (!top5.find((x: any) => x.id === t.id)) {
          top5.push(t);
        }
      }
    }

    return NextResponse.json(
      {
        top5,
        updated_at: new Date().toISOString(),
        total_scored: scored.length,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err: any) {
    console.error("Weekly top 5 API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
