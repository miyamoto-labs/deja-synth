import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CLOB_HOST = "https://clob.polymarket.com";

interface OrderLevel {
  price: string;
  size: string;
}

/**
 * GET /api/clob/book?token_id=xxx
 * Fetches the live order book (bids + asks) from the Polymarket CLOB.
 *
 * Returns: { bids, asks, spread, last_trade_price }
 * - bids sorted price DESC (best bid first)
 * - asks sorted price ASC (best ask first)
 */
export async function GET(request: NextRequest) {
  try {
    const tokenId = request.nextUrl.searchParams.get("token_id");

    if (!tokenId) {
      return NextResponse.json(
        { error: "token_id is required" },
        { status: 400 }
      );
    }

    const res = await fetch(`${CLOB_HOST}/book?token_id=${tokenId}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 5 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { bids: [], asks: [], spread: 0, last_trade_price: 0 },
        {
          headers: {
            "Cache-Control": "s-maxage=5, stale-while-revalidate=10",
          },
        }
      );
    }

    const data = await res.json();

    // Parse and sort
    const bids: { price: number; size: number }[] = (data.bids || [])
      .map((b: OrderLevel) => ({
        price: parseFloat(b.price),
        size: parseFloat(b.size),
      }))
      .filter((b: { price: number; size: number }) => b.price > 0 && b.size > 0)
      .sort((a: { price: number }, b: { price: number }) => b.price - a.price);

    const asks: { price: number; size: number }[] = (data.asks || [])
      .map((a: OrderLevel) => ({
        price: parseFloat(a.price),
        size: parseFloat(a.size),
      }))
      .filter((a: { price: number; size: number }) => a.price > 0 && a.size > 0)
      .sort((a: { price: number }, b: { price: number }) => a.price - b.price);

    const bestBid = bids[0]?.price ?? 0;
    const bestAsk = asks[0]?.price ?? 1;
    const spread = bestAsk - bestBid;
    const lastTradePrice = parseFloat(data.last_trade_price) || 0;

    return NextResponse.json(
      { bids, asks, spread, last_trade_price: lastTradePrice },
      {
        headers: {
          "Cache-Control": "s-maxage=5, stale-while-revalidate=10",
        },
      }
    );
  } catch (err: any) {
    console.error("CLOB book API error:", err);
    return NextResponse.json(
      { bids: [], asks: [], spread: 0, last_trade_price: 0 },
      {
        headers: {
          "Cache-Control": "s-maxage=5, stale-while-revalidate=10",
        },
      }
    );
  }
}
