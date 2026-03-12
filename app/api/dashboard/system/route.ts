import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase-server";

export const revalidate = 30;

export async function GET() {
  try {
    const sb = getSupabase();

    // Last scan time from audit log (v1 logs "conviction", v2 logs "conviction_v2")
    const { data: lastScan } = await sb
      .from("ep_audit_log")
      .select("created_at, event_data")
      .in("event_type", ["conviction", "conviction_v2"])
      .order("created_at", { ascending: false })
      .limit(1);

    // Count totals
    const { count: marketsCount } = await sb
      .from("ep_markets_raw")
      .select("*", { count: "exact", head: true })
      .eq("active", true);

    const { count: opportunitiesCount } = await sb
      .from("ep_detected_opportunities")
      .select("*", { count: "exact", head: true });

    const { count: picksCount } = await sb
      .from("ep_curated_picks")
      .select("*", { count: "exact", head: true });

    const { count: snapshotsCount } = await sb
      .from("ep_price_snapshots")
      .select("*", { count: "exact", head: true });

    // Recent errors from audit log
    const { data: recentErrors } = await sb
      .from("ep_audit_log")
      .select("*")
      .in("event_type", ["error", "warning"])
      .order("created_at", { ascending: false })
      .limit(5);

    return NextResponse.json(
      {
        last_scan: lastScan?.[0]?.created_at || null,
        last_scan_data: lastScan?.[0]?.event_data || null,
        markets_tracked: marketsCount || 0,
        opportunities_detected: opportunitiesCount || 0,
        picks_generated: picksCount || 0,
        price_snapshots: snapshotsCount || 0,
        recent_errors: recentErrors || [],
        engine_status: "running",
      },
      {
        headers: {
          "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (err: any) {
    console.error("System API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
