import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/dashboard/trade
 * Proxies a trade request to the bot's trader microservice.
 * Dashboard never touches wallet credentials — the bot handles that.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tokenId, side, amount, price } = body;

    // Validate
    if (!tokenId || !side || !amount || !price) {
      return NextResponse.json(
        { error: "Missing required fields: tokenId, side, amount, price" },
        { status: 400 }
      );
    }

    if (amount < 1 || amount > 1000) {
      return NextResponse.json(
        { error: "Amount must be between $1 and $1,000" },
        { status: 400 }
      );
    }

    if (!["BUY", "SELL"].includes(side)) {
      return NextResponse.json(
        { error: "Side must be BUY or SELL" },
        { status: 400 }
      );
    }

    const traderUrl = process.env.BOT_TRADER_URL;
    const traderKey = process.env.BOT_TRADER_KEY;

    if (!traderUrl || !traderKey) {
      return NextResponse.json(
        { error: "Trading not configured" },
        { status: 503 }
      );
    }

    // Forward to the bot's trader microservice
    const resp = await fetch(`${traderUrl}/forward-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": traderKey,
      },
      body: JSON.stringify({
        tokenId,
        side,
        amount,
        price,
      }),
    });

    const result = await resp.json();

    if (result.success || result.orderID) {
      return NextResponse.json({
        success: true,
        orderID: result.orderID || null,
        message: `Order placed: ${side} $${amount} at ${(price * 100).toFixed(0)}c`,
      });
    }

    return NextResponse.json(
      { success: false, error: result.error || "Order failed" },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("Trade API error:", err);
    return NextResponse.json(
      { error: err.message || "Trade failed" },
      { status: 500 }
    );
  }
}
