import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CLOB_HOST = "https://clob.polymarket.com";
const MAX_TOKENS = 50;

interface PricePoint {
  t: number;
  p: number;
}

/**
 * POST /api/clob/price-history
 * Batch-fetches price history from the Polymarket CLOB for multiple tokens.
 *
 * Body: { tokenIds: string[], interval?: string, fidelity?: number }
 * Response: { histories: { [tokenId: string]: { t: number, p: number }[] } }
 *
 * Defaults: interval=1d, fidelity=60 (24 points for sparklines).
 * For detail charts, pass higher fidelity (e.g. interval=1w, fidelity=60).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tokenIds: string[] = body?.tokenIds;
    const interval: string = body?.interval || "1d";
    const fidelity: number = body?.fidelity || 60;

    if (!Array.isArray(tokenIds) || tokenIds.length === 0) {
      return NextResponse.json(
        { error: "tokenIds array is required" },
        { status: 400 }
      );
    }

    // Cap and deduplicate
    const unique = [...new Set(tokenIds)].slice(0, MAX_TOKENS);

    // Fetch price history for each token in parallel
    const results = await Promise.allSettled(
      unique.map(async (tokenId) => {
        const url = `${CLOB_HOST}/prices-history?market=${tokenId}&interval=${interval}&fidelity=${fidelity}`;
        const res = await fetch(url, {
          headers: { Accept: "application/json" },
          next: { revalidate: 60 },
        });

        if (!res.ok) return { tokenId, history: [] as PricePoint[] };

        const data = await res.json();
        const history: PricePoint[] = (data.history || []).map(
          (pt: { t: number; p: number }) => ({
            t: pt.t,
            p: typeof pt.p === "string" ? parseFloat(pt.p) : pt.p,
          })
        );

        return { tokenId, history };
      })
    );

    // Build response map
    const histories: Record<string, PricePoint[]> = {};
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.history.length > 0) {
        histories[result.value.tokenId] = result.value.history;
      }
    }

    return NextResponse.json(
      { histories },
      {
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (err: any) {
    console.error("CLOB price-history API error:", err);
    return NextResponse.json(
      { histories: {} },
      {
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  }
}
