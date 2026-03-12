import { NextResponse } from "next/server";
import { getCachedOrRefresh } from "@/app/lib/lp-scoring";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await getCachedOrRefresh(4);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=1800" },
    });
  } catch (err: any) {
    console.error("Earn API error:", err);
    return NextResponse.json(
      { error: err.message, markets: [], stats: null, scored_at: null },
      { status: 500 }
    );
  }
}
