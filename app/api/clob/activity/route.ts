import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase-server";

export const dynamic = "force-dynamic";

const DATA_API = "https://data-api.polymarket.com";

/**
 * GET /api/clob/activity?conditionId=xxx&limit=20
 *
 * Fetches recent trade activity from the Polymarket Data API, which returns
 * rich trader identity (pseudonym, name, proxyWallet, profileImage).
 * Then enriches with tracked trader data from ep_tracked_traders.
 *
 * Returns: {
 *   trades: [{
 *     side, price, size, timestamp, outcome,
 *     trader: { username, name, wallet, profileImage },
 *     enrichment?: { id, alias, roi, win_rate, bankroll_tier, trading_style, total_pnl }
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const conditionId = request.nextUrl.searchParams.get("conditionId");
    const limit = parseInt(
      request.nextUrl.searchParams.get("limit") || "20",
      10
    );

    if (!conditionId) {
      return NextResponse.json(
        { error: "conditionId is required" },
        { status: 400 }
      );
    }

    // 1. Fetch trades from Data API with market filter (condition_id)
    //    This returns rich user data: pseudonym, name, proxyWallet, profileImage
    const params = new URLSearchParams({
      market: conditionId,
      limit: String(limit),
    });

    const res = await fetch(`${DATA_API}/trades?${params}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 5 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { trades: [] },
        {
          headers: {
            "Cache-Control": "s-maxage=5, stale-while-revalidate=15",
          },
        }
      );
    }

    const raw = await res.json();

    // 2. Parse trades with trader identity
    const rawTrades = (Array.isArray(raw) ? raw : []).map((e: any) => ({
      side: e.side || "BUY",
      price:
        typeof e.price === "number" ? e.price : parseFloat(e.price) || 0,
      size: typeof e.size === "number" ? e.size : parseFloat(e.size) || 0,
      timestamp: e.timestamp,
      outcome: e.outcome || "",
      trader: {
        username: e.pseudonym || "anon",
        name: e.name || "",
        wallet: e.proxyWallet || "",
        profileImage: e.profileImage || "",
      },
    }));

    // 3. Collect unique wallets for enrichment lookup
    //    We look up by wallet_address since the data-api gives us proxyWallet
    const wallets = [
      ...new Set(
        rawTrades
          .map((t: any) => t.trader.wallet?.toLowerCase())
          .filter((w: string) => w && w.length > 2)
      ),
    ];

    let enrichmentMap: Record<string, any> = {};

    if (wallets.length > 0) {
      try {
        const supabase = getSupabase();
        const { data: trackedTraders } = await supabase
          .from("ep_tracked_traders")
          .select(
            "id, alias, wallet_address, polymarket_username, roi, win_rate, bankroll_tier, trading_style, total_pnl"
          )
          .in("wallet_address", wallets);

        if (trackedTraders) {
          for (const t of trackedTraders) {
            enrichmentMap[t.wallet_address?.toLowerCase()] = {
              id: t.id,
              alias: t.alias,
              wallet_address: t.wallet_address,
              roi: t.roi,
              win_rate: t.win_rate,
              bankroll_tier: t.bankroll_tier,
              trading_style: t.trading_style,
              total_pnl: t.total_pnl,
            };
          }
        }
      } catch (err) {
        // Enrichment is best-effort — continue without it
        console.warn("Activity enrichment lookup failed:", err);
      }
    }

    // 4. Merge enrichment into trades
    const trades = rawTrades.map((t: any) => ({
      ...t,
      enrichment:
        enrichmentMap[t.trader.wallet?.toLowerCase()] || null,
    }));

    return NextResponse.json(
      { trades },
      {
        headers: {
          "Cache-Control": "s-maxage=5, stale-while-revalidate=15",
        },
      }
    );
  } catch (err: any) {
    console.error("CLOB activity API error:", err);
    return NextResponse.json(
      { trades: [] },
      {
        headers: {
          "Cache-Control": "s-maxage=5, stale-while-revalidate=15",
        },
      }
    );
  }
}
