import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const status = searchParams.get("status"); // active, won, lost, or null for all
    const category = searchParams.get("category"); // politics, sports, crypto, etc.

    const sb = getSupabase();

    // ── Main picks query ────────────────────────
    let query = sb
      .from("ep_curated_picks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) {
      if (status === "resolved") {
        // Resolved = everything except active (won, lost, stopped, hit_target, expired, etc.)
        query = query.neq("status", "active");
      } else {
        query = query.eq("status", status);
      }
    }

    if (category && category !== "all" && category !== "wild") {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Picks API error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const picks = data || [];

    // ── Daily Super Pick ────────────────────────
    // Highest composite_score active pick created today (UTC)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const { data: superPickData } = await sb
      .from("ep_curated_picks")
      .select("*")
      .eq("status", "active")
      .not("question", "is", null)
      .gte("created_at", todayStart.toISOString())
      .order("composite_score", { ascending: false })
      .limit(1);

    let superPick = null;

    if (superPickData && superPickData.length > 0) {
      superPick = superPickData[0];
    } else {
      // Fallback: highest composite_score active pick of all time
      const { data: fallbackData } = await sb
        .from("ep_curated_picks")
        .select("*")
        .eq("status", "active")
        .not("question", "is", null)
        .order("composite_score", { ascending: false })
        .limit(1);

      if (fallbackData && fallbackData.length > 0) {
        superPick = fallbackData[0];
      }
    }

    return NextResponse.json(
      { picks, superPick, count: picks.length },
      {
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (err: any) {
    console.error("Picks API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
