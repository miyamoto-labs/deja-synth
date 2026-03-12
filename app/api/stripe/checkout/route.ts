import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabase } from "@/app/lib/supabase-server";

export const dynamic = "force-dynamic";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2025-01-27.acacia" as any });
}

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout Session for Pro subscription.
 *
 * Body: { wallet: string, tier: "pro" | "whale" }
 */
export async function POST(request: Request) {
  try {
    const stripe = getStripe();
    const { wallet, tier } = await request.json();

    if (!wallet) {
      return NextResponse.json(
        { error: "Missing wallet address" },
        { status: 400 }
      );
    }

    const validTier = tier === "whale" ? "whale" : "pro";

    // Price IDs from Stripe Dashboard — set in env vars
    const priceId =
      validTier === "pro"
        ? process.env.STRIPE_PRO_PRICE_ID
        : process.env.STRIPE_WHALE_PRICE_ID;

    if (!priceId) {
      return NextResponse.json(
        { error: `No price configured for ${validTier} tier` },
        { status: 500 }
      );
    }

    // Check if user already has a Stripe customer ID
    const supabase = getSupabase();
    const { data: user } = await supabase
      .from("ep_users")
      .select("stripe_customer_id")
      .eq("wallet_address", wallet.toLowerCase())
      .single();

    let customerId = user?.stripe_customer_id;

    // Create customer if needed
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { wallet_address: wallet.toLowerCase() },
      });
      customerId = customer.id;

      // Store customer ID
      await supabase
        .from("ep_users")
        .update({ stripe_customer_id: customerId })
        .eq("wallet_address", wallet.toLowerCase());
    }

    // Create checkout session
    const origin = request.headers.get("origin") || "https://deja.market";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?subscription=success`,
      cancel_url: `${origin}/dashboard?subscription=canceled`,
      subscription_data: {
        trial_period_days: 7,
        metadata: { wallet_address: wallet.toLowerCase(), tier: validTier },
      },
      metadata: { wallet_address: wallet.toLowerCase(), tier: validTier },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
