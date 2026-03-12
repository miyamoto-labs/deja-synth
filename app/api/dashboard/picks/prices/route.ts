import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GAMMA_URL = "https://gamma-api.polymarket.com";
const MAX_CONCURRENT = 10;

interface PriceResult {
  yes: number;
  no: number;
  yesToken: string;
  noToken: string;
}

/**
 * GET /api/dashboard/picks/prices?ids=slug1,slug2,...
 * Batch-fetches live prices from Gamma API for a list of market slugs.
 * Also supports hex condition_ids as fallback (but slug is preferred for accuracy).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsRaw = searchParams.get("ids") || "";
    const ids = idsRaw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "No IDs provided" },
        { status: 400 }
      );
    }

    // Cap at 100 to prevent abuse
    const capped = ids.slice(0, 100);

    // Fetch in parallel with concurrency limit
    const prices: Record<string, PriceResult> = {};
    for (let i = 0; i < capped.length; i += MAX_CONCURRENT) {
      const batch = capped.slice(i, i + MAX_CONCURRENT);
      const results = await Promise.allSettled(
        batch.map((id) => fetchMarketPrice(id))
      );

      results.forEach((result, idx) => {
        if (result.status === "fulfilled" && result.value) {
          prices[batch[idx]] = result.value;
        }
      });
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
    console.error("Picks prices API error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch prices" },
      { status: 500 }
    );
  }
}

async function fetchMarketPrice(id: string): Promise<PriceResult | null> {
  try {
    const isHex = id.startsWith("0x");
    const param = isHex ? `condition_id=${id}` : `slug=${id}`;
    const res = await fetch(`${GAMMA_URL}/markets?${param}&limit=1`, {
      next: { revalidate: 0 },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const market = data[0];
    if (!market) return null;

    // Parse outcome prices
    const rawPrices = market.outcomePrices || "[]";
    const outcomePrices: string[] =
      typeof rawPrices === "string" ? JSON.parse(rawPrices) : rawPrices;

    // Parse CLOB token IDs
    const rawTokens = market.clobTokenIds || "[]";
    const clobTokenIds: string[] =
      typeof rawTokens === "string" ? JSON.parse(rawTokens) : rawTokens;

    return {
      yes: outcomePrices[0] ? parseFloat(outcomePrices[0]) : 0.5,
      no: outcomePrices[1] ? parseFloat(outcomePrices[1]) : 0.5,
      yesToken: clobTokenIds[0] || "",
      noToken: clobTokenIds[1] || "",
    };
  } catch {
    return null;
  }
}
