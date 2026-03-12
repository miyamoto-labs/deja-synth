import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase-server";

export const revalidate = 60;

// Polymarket fee on winning side (~2%)
const FEE_RATE = 0.02;

// Minimum spread to qualify as an opportunity (0.5 cents)
const MIN_SPREAD = 0.005;

interface ArbOpportunity {
  market_id: string;
  question: string;
  category: string;
  yes_price: number;
  no_price: number;
  yes_token: string;
  no_token: string;
  volume: number;
  liquidity: number;
  end_date: string;
  priceSum: number;
  spread: number;
  spreadPercent: number;
  profitPer100: number;
  arbType: "spread";
  riskLevel: "low" | "medium" | "high";
}

/**
 * GET /api/dashboard/arb-scanner
 * Scans all active markets for spread arbitrage opportunities.
 * A spread arb exists when YES + NO < $1.00 — buying both sides
 * guarantees a profit when the market resolves.
 */
export async function GET() {
  try {
    const sb = getSupabase();

    const { data: markets, error } = await sb
      .from("ep_markets_raw")
      .select(
        "market_id, question, category, yes_price, no_price, yes_token, no_token, volume, liquidity, end_date"
      )
      .eq("active", true)
      .order("volume", { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = markets || [];
    const totalScanned = rows.length;

    // Find arb opportunities
    const opportunities: ArbOpportunity[] = [];

    for (const m of rows) {
      const yesPrice = m.yes_price || 0;
      const noPrice = m.no_price || 0;

      // Skip extreme prices (near 0 or near 1)
      if (yesPrice < 0.01 || noPrice < 0.01) continue;
      if (yesPrice > 0.99 || noPrice > 0.99) continue;

      const priceSum = yesPrice + noPrice;
      const spread = 1.0 - priceSum; // positive = arb exists

      if (spread < MIN_SPREAD) continue;

      const spreadPercent = spread * 100;

      // Profit per $100 invested (buy both sides)
      // You spend $priceSum per share pair, win $1 when market resolves
      const grossProfit = (1.0 / priceSum - 1.0) * 100;
      const feeOnPayout = (100 / priceSum) * FEE_RATE;
      const profitPer100 = grossProfit - feeOnPayout;

      // Risk level based on spread size
      let riskLevel: "low" | "medium" | "high";
      if (spreadPercent > 3) riskLevel = "low";
      else if (spreadPercent > 1.5) riskLevel = "medium";
      else riskLevel = "high";

      opportunities.push({
        market_id: m.market_id,
        question: m.question || "Unknown market",
        category: m.category || "other",
        yes_price: yesPrice,
        no_price: noPrice,
        yes_token: m.yes_token || "",
        no_token: m.no_token || "",
        volume: m.volume || 0,
        liquidity: m.liquidity || 0,
        end_date: m.end_date || "",
        priceSum,
        spread,
        spreadPercent,
        profitPer100,
        arbType: "spread",
        riskLevel,
      });
    }

    // Sort by profit descending
    opportunities.sort((a, b) => b.profitPer100 - a.profitPer100);

    // Aggregate stats
    const totalOpps = opportunities.length;
    const avgSpread =
      totalOpps > 0
        ? opportunities.reduce((s, o) => s + o.spreadPercent, 0) / totalOpps
        : 0;
    const bestProfit = totalOpps > 0 ? opportunities[0].profitPer100 : 0;

    return NextResponse.json(
      {
        opportunities,
        stats: {
          total_opportunities: totalOpps,
          avg_spread: Math.round(avgSpread * 100) / 100,
          best_profit: Math.round(bestProfit * 100) / 100,
          total_markets_scanned: totalScanned,
        },
        scanned_at: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (err: any) {
    console.error("Arb scanner error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
