import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase-server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * USDC payment config
 * Users send USDC on Polygon to this wallet.
 * We add a tiny unique decimal (e.g. $9.001234) so we can match
 * each payment on-chain to a specific user.
 */
const RECEIVING_WALLET = "0x8a3400cB4c98013dc8C2531D1f2158c2BF9da6c2";

const TIER_PRICES: Record<string, number> = {
  pro: 9,
  whale: 99,
};

/**
 * POST /api/usdc/checkout
 * Creates a USDC payment intent — stores expected amount + wallet in DB.
 *
 * Body: { wallet: string, tier: "pro" | "whale" }
 * Returns: { paymentId, amount, receivingWallet, chain, token }
 */
export async function POST(request: Request) {
  try {
    const { wallet, tier } = await request.json();

    if (!wallet) {
      return NextResponse.json(
        { error: "Missing wallet address" },
        { status: 400 }
      );
    }

    const validTier = tier === "whale" ? "whale" : "pro";
    const basePrice = TIER_PRICES[validTier];

    // Generate unique micro-amount suffix so we can match on-chain
    // e.g. $29.001234 — the last 6 decimals are unique per payment
    const uniqueSuffix = crypto.randomInt(1, 999999);
    const amount = basePrice + uniqueSuffix / 1_000_000;
    const amountStr = amount.toFixed(6);

    const paymentId = `usdc_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    const supabase = getSupabase();

    // Store payment intent in DB
    const { error: insertError } = await supabase
      .from("ep_usdc_payments")
      .insert({
        id: paymentId,
        wallet_address: wallet.toLowerCase(),
        tier: validTier,
        expected_amount: amountStr,
        receiving_wallet: RECEIVING_WALLET.toLowerCase(),
        status: "pending",
        chain: "polygon",
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min expiry
      });

    if (insertError) {
      console.error("Failed to create USDC payment:", insertError);
      return NextResponse.json(
        { error: "Failed to create payment" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      paymentId,
      amount: amountStr,
      receivingWallet: RECEIVING_WALLET,
      chain: "polygon",
      token: "USDC",
      expiresIn: 1800, // 30 minutes in seconds
    });
  } catch (err: any) {
    console.error("USDC checkout error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create USDC checkout" },
      { status: 500 }
    );
  }
}
