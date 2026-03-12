import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * POST /api/trades/record-redeem
 * Records a successful redemption in ep_user_trades so it shows in the Closed tab.
 *
 * Body: { walletAddress, tokenId, shares, avgPrice, won }
 *
 * Finds matching unresolved BUY trades for this token and marks them resolved
 * with the appropriate realized_pnl.
 */
export async function POST(request: Request) {
  try {
    const { walletAddress, tokenId, shares, avgPrice, won } =
      await request.json();

    if (!walletAddress || !tokenId) {
      return NextResponse.json(
        { error: "Missing walletAddress or tokenId" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const address = walletAddress.toLowerCase();
    const now = new Date().toISOString();

    // Find unresolved BUY trades matching this token
    const { data: trades, error: fetchErr } = await supabase
      .from("ep_user_trades")
      .select("id, amount, shares, price")
      .eq("user_wallet", address)
      .eq("token_id", tokenId)
      .eq("side", "BUY")
      .is("resolved_at", null);

    if (fetchErr) {
      console.error("[record-redeem] Fetch error:", fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!trades || trades.length === 0) {
      // No matching trades — might already be resolved or trade was from before tracking
      return NextResponse.json({ updated: 0 });
    }

    let updated = 0;
    for (const trade of trades) {
      const amount = parseFloat(trade.amount) || 0;
      const tradeShares = parseFloat(trade.shares) || 0;
      // Won: each share pays $1. Lost: shares worth $0.
      const pnl = won ? tradeShares * 1.0 - amount : -amount;

      const { error: updateErr } = await supabase
        .from("ep_user_trades")
        .update({
          realized_pnl: Math.round(pnl * 100) / 100,
          resolved_at: now,
        })
        .eq("id", trade.id);

      if (!updateErr) updated++;
    }

    return NextResponse.json({ updated });
  } catch (err: any) {
    console.error("[record-redeem] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to record redemption" },
      { status: 500 }
    );
  }
}
