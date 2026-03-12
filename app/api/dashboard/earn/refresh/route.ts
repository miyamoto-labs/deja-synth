import { NextResponse } from "next/server";
import { fetchAndScoreAllMarkets } from "@/app/lib/lp-scoring";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await fetchAndScoreAllMarkets();
    return NextResponse.json({
      success: true,
      scored: result.markets.length,
      scored_at: result.scored_at,
    });
  } catch (err: any) {
    console.error("Earn refresh error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
