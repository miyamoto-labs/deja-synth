import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase-server";

export const dynamic = "force-dynamic";

const ADMIN_KEY = process.env.ADMIN_API_KEY;

/**
 * GET /api/dashboard/admin/scanner/history
 * Returns aggregated scan history from ep_curated_picks:
 * - Recent picks grouped by scan batch (created_at buckets)
 * - Category distribution
 * - Tier distribution
 * - Win/loss stats
 */
export async function GET(request: Request) {
  if (!ADMIN_KEY) {
    return NextResponse.json({ error: "Admin access not configured" }, { status: 503 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${ADMIN_KEY}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabase();

    // Get picks from last 7 days for history
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: picks, error } = await supabase
      .from("ep_curated_picks")
      .select("id, question, direction, tier, composite_score, category, status, entry_price, created_at, slug")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    // Group by scan batch (picks created within 5 min window = same batch)
    const batches: {
      batchTime: string;
      count: number;
      tiers: Record<string, number>;
      categories: Record<string, number>;
      avgScore: number;
      topPick?: any;
    }[] = [];

    let currentBatch: typeof picks = [];
    let batchStart: Date | null = null;

    for (const pick of picks || []) {
      const pickTime = new Date(pick.created_at);

      if (!batchStart || pickTime.getTime() < batchStart.getTime() - 5 * 60 * 1000) {
        // New batch
        if (currentBatch.length > 0) {
          batches.push(summarizeBatch(currentBatch, batchStart!));
        }
        currentBatch = [pick];
        batchStart = pickTime;
      } else {
        currentBatch.push(pick);
      }
    }
    // Don't forget the last batch
    if (currentBatch.length > 0 && batchStart) {
      batches.push(summarizeBatch(currentBatch, batchStart));
    }

    // Overall stats
    const allPicks = picks || [];
    const totalPicks = allPicks.length;
    const activePicks = allPicks.filter((p) => p.status === "active").length;
    const wonPicks = allPicks.filter((p) => p.status === "won").length;
    const lostPicks = allPicks.filter((p) => p.status === "lost").length;
    const tierDist: Record<string, number> = {};
    const catDist: Record<string, number> = {};
    let scoreSum = 0;

    for (const p of allPicks) {
      tierDist[p.tier || "?"] = (tierDist[p.tier || "?"] || 0) + 1;
      catDist[p.category || "unknown"] = (catDist[p.category || "unknown"] || 0) + 1;
      scoreSum += p.composite_score || 0;
    }

    return NextResponse.json({
      stats: {
        totalPicks,
        activePicks,
        wonPicks,
        lostPicks,
        winRate: wonPicks + lostPicks > 0 ? ((wonPicks / (wonPicks + lostPicks)) * 100).toFixed(1) : "N/A",
        avgScore: totalPicks > 0 ? (scoreSum / totalPicks).toFixed(1) : 0,
        tierDistribution: tierDist,
        categoryDistribution: catDist,
      },
      batches: batches.slice(0, 20), // Last 20 scan batches
    });
  } catch (err: any) {
    console.error("Scanner history error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch history" },
      { status: 500 }
    );
  }
}

function summarizeBatch(picks: any[], batchTime: Date) {
  const tiers: Record<string, number> = {};
  const categories: Record<string, number> = {};
  let scoreSum = 0;
  let topPick = picks[0];

  for (const p of picks) {
    tiers[p.tier || "?"] = (tiers[p.tier || "?"] || 0) + 1;
    categories[p.category || "unknown"] = (categories[p.category || "unknown"] || 0) + 1;
    scoreSum += p.composite_score || 0;
    if ((p.composite_score || 0) > (topPick?.composite_score || 0)) {
      topPick = p;
    }
  }

  return {
    batchTime: batchTime.toISOString(),
    count: picks.length,
    tiers,
    categories,
    avgScore: picks.length > 0 ? Math.round(scoreSum / picks.length) : 0,
    topPick: topPick
      ? {
          question: topPick.question?.slice(0, 80),
          direction: topPick.direction,
          tier: topPick.tier,
          score: topPick.composite_score,
        }
      : undefined,
  };
}
