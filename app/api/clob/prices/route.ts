import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CLOB_HOST = "https://clob.polymarket.com";
const MAX_TOKENS = 500;

/**
 * POST /api/clob/prices
 * Batch-fetches live midpoint prices from the Polymarket CLOB.
 *
 * Body: { tokenIds: string[] }
 * Response: { prices: { [tokenId: string]: number } }
 *
 * The midpoint is the average of the best bid and best ask — the most
 * accurate "current price" available without executing a trade.
 */
export async function POST(request: Request) {
  try {
    // Guard against empty body (e.g. aborted requests, preflight)
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ prices: {} });
    }
    const tokenIds: string[] = body?.tokenIds;

    if (!Array.isArray(tokenIds) || tokenIds.length === 0) {
      return NextResponse.json(
        { error: "tokenIds array is required" },
        { status: 400 }
      );
    }

    // Cap and deduplicate
    const unique = [...new Set(tokenIds)].slice(0, MAX_TOKENS);

    // POST to CLOB /midpoints — accepts [{token_id: "..."}, ...]
    const res = await fetch(`${CLOB_HOST}/midpoints`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(unique.map((id) => ({ token_id: id }))),
      next: { revalidate: 5 },
    });

    if (!res.ok) {
      console.error(`CLOB midpoints error: ${res.status}`);
      // Return empty prices instead of failing — page falls back to Gamma prices
      return NextResponse.json(
        { prices: {} },
        {
          headers: {
            "Cache-Control": "s-maxage=5, stale-while-revalidate=10",
          },
        }
      );
    }

    // CLOB returns { "tokenId": "0.45", ... } — parse strings to numbers
    const raw: Record<string, string> = await res.json();
    const prices: Record<string, number> = {};

    for (const [tokenId, priceStr] of Object.entries(raw)) {
      const price = parseFloat(priceStr);
      if (!isNaN(price) && price > 0) {
        prices[tokenId] = price;
      }
    }

    return NextResponse.json(
      { prices },
      {
        headers: {
          "Cache-Control": "s-maxage=5, stale-while-revalidate=10",
        },
      }
    );
  } catch (err: any) {
    console.error("CLOB prices API error:", err);
    // Graceful fallback — never break the markets page
    return NextResponse.json(
      { prices: {} },
      {
        headers: {
          "Cache-Control": "s-maxage=5, stale-while-revalidate=10",
        },
      }
    );
  }
}
