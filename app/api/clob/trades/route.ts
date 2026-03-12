import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DATA_API = "https://data-api.polymarket.com";

/**
 * GET /api/clob/trades?market=xxx&limit=20
 * Fetches recent trades from the Polymarket Data API.
 *
 * Returns: [{ side, price, size, timestamp, outcome, transactionHash }]
 */
export async function GET(request: NextRequest) {
  try {
    const market = request.nextUrl.searchParams.get("market");
    const limit = request.nextUrl.searchParams.get("limit") || "20";

    if (!market) {
      return NextResponse.json(
        { error: "market (condition_id) is required" },
        { status: 400 }
      );
    }

    const params = new URLSearchParams({
      market,
      limit,
    });

    const res = await fetch(`${DATA_API}/trades?${params}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 10 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { trades: [] },
        {
          headers: {
            "Cache-Control": "s-maxage=10, stale-while-revalidate=20",
          },
        }
      );
    }

    const raw = await res.json();

    // Normalize the response — Data API returns an array directly
    const trades = (Array.isArray(raw) ? raw : []).map((t: any) => ({
      side: t.side || "BUY",
      price: typeof t.price === "number" ? t.price : parseFloat(t.price) || 0,
      size: typeof t.size === "number" ? t.size : parseFloat(t.size) || 0,
      timestamp: t.timestamp,
      outcome: t.outcome || "",
      transactionHash: t.transactionHash || "",
    }));

    return NextResponse.json(
      { trades },
      {
        headers: {
          "Cache-Control": "s-maxage=10, stale-while-revalidate=20",
        },
      }
    );
  } catch (err: any) {
    console.error("CLOB trades API error:", err);
    return NextResponse.json(
      { trades: [] },
      {
        headers: {
          "Cache-Control": "s-maxage=10, stale-while-revalidate=20",
        },
      }
    );
  }
}
