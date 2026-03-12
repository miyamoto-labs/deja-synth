import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/subscription/status?wallet=0x...
 * Returns the user's subscription tier and status.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get("wallet")?.toLowerCase();

    if (!wallet) {
      return NextResponse.json(
        { error: "Missing wallet query parameter" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("ep_users")
      .select("subscription_tier, subscription_status, stripe_customer_id, subscription_expires_at")
      .eq("wallet_address", wallet)
      .single();

    if (error || !data) {
      // No user record — default to free
      return NextResponse.json({
        tier: "free",
        status: "none",
        hasStripe: false,
      });
    }

    let tier = data.subscription_tier || "free";
    let status = data.subscription_status || "none";
    const hasStripe = !!data.stripe_customer_id;

    // Check USDC subscription expiry (Stripe manages its own renewals via webhooks)
    if (
      tier !== "free" &&
      status === "active" &&
      !hasStripe &&
      data.subscription_expires_at
    ) {
      const expiresAt = new Date(data.subscription_expires_at);
      if (expiresAt < new Date()) {
        // USDC subscription expired — downgrade to free
        tier = "free";
        status = "expired";

        // Update DB
        await supabase
          .from("ep_users")
          .update({
            subscription_tier: "free",
            subscription_status: "expired",
          })
          .eq("wallet_address", wallet);
      }
    }

    return NextResponse.json({
      tier,
      status,
      hasStripe,
      expiresAt: data.subscription_expires_at || null,
    });
  } catch (err: any) {
    console.error("Subscription status error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch subscription status" },
      { status: 500 }
    );
  }
}
