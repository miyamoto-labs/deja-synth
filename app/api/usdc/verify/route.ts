import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * USDC on Polygon (PoS) contract address
 */
const USDC_CONTRACT = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"; // native USDC on Polygon

/**
 * POST /api/usdc/verify
 * Checks on-chain for a matching USDC transfer.
 * Uses Polygonscan API to find ERC-20 transfers to our wallet.
 *
 * Body: { paymentId: string }
 * Returns: { verified: boolean, status: string }
 */
export async function POST(request: Request) {
  try {
    const { paymentId } = await request.json();

    if (!paymentId) {
      return NextResponse.json(
        { error: "Missing paymentId" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Fetch the payment intent
    const { data: payment, error: fetchError } = await supabase
      .from("ep_usdc_payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    // Already verified
    if (payment.status === "confirmed") {
      return NextResponse.json({
        verified: true,
        status: "confirmed",
      });
    }

    // Check if expired
    if (new Date(payment.expires_at) < new Date()) {
      await supabase
        .from("ep_usdc_payments")
        .update({ status: "expired" })
        .eq("id", paymentId);

      return NextResponse.json({
        verified: false,
        status: "expired",
      });
    }

    // Query Polygonscan for USDC transfers to our receiving wallet
    // Look for transfers after the payment was created
    const createdTimestamp = Math.floor(
      new Date(payment.created_at).getTime() / 1000
    );

    const polygonscanKey = process.env.POLYGONSCAN_API_KEY || "";
    const receivingWallet = payment.receiving_wallet;

    const url = new URL("https://api.polygonscan.com/api");
    url.searchParams.set("module", "account");
    url.searchParams.set("action", "tokentx");
    url.searchParams.set("contractaddress", USDC_CONTRACT);
    url.searchParams.set("address", receivingWallet);
    url.searchParams.set("startblock", "0");
    url.searchParams.set("endblock", "99999999");
    url.searchParams.set("sort", "desc");
    url.searchParams.set("page", "1");
    url.searchParams.set("offset", "20"); // last 20 transfers
    if (polygonscanKey) {
      url.searchParams.set("apikey", polygonscanKey);
    }

    const scanRes = await fetch(url.toString());
    const scanData = await scanRes.json();

    if (scanData.status !== "1" || !Array.isArray(scanData.result)) {
      // No transactions found or API error — not verified yet
      return NextResponse.json({
        verified: false,
        status: "pending",
        message: "No matching transaction found yet",
      });
    }

    // USDC has 6 decimals on Polygon
    const expectedAmountRaw = Math.round(
      parseFloat(payment.expected_amount) * 1_000_000
    ).toString();

    // Find a matching transfer
    const match = scanData.result.find((tx: any) => {
      const isToUs =
        tx.to.toLowerCase() === receivingWallet.toLowerCase();
      const isCorrectAmount = tx.value === expectedAmountRaw;
      const isAfterCreation = parseInt(tx.timeStamp) >= createdTimestamp - 60; // 60s grace
      return isToUs && isCorrectAmount && isAfterCreation;
    });

    if (!match) {
      return NextResponse.json({
        verified: false,
        status: "pending",
        message: "No matching transaction found yet",
      });
    }

    // Match found — activate subscription
    const txHash = match.hash;

    // Update payment record
    await supabase
      .from("ep_usdc_payments")
      .update({
        status: "confirmed",
        tx_hash: txHash,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", paymentId);

    // Activate the user's subscription (30-day period for USDC payments)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await supabase
      .from("ep_users")
      .update({
        subscription_tier: payment.tier,
        subscription_status: "active",
        subscription_expires_at: expiresAt.toISOString(),
      })
      .eq("wallet_address", payment.wallet_address);

    console.log(
      `USDC payment confirmed: ${payment.wallet_address} → ${payment.tier} (tx: ${txHash})`
    );

    return NextResponse.json({
      verified: true,
      status: "confirmed",
      txHash,
    });
  } catch (err: any) {
    console.error("USDC verify error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to verify USDC payment" },
      { status: 500 }
    );
  }
}
