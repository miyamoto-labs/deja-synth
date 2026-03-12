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
 * POST /api/stripe/webhook
 * Handles Stripe webhook events for subscription lifecycle.
 */
export async function POST(request: Request) {
  try {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

    const body = await request.text();
    const sig = request.headers.get("stripe-signature");

    if (!sig) {
      return NextResponse.json(
        { error: "Missing stripe-signature" },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const wallet = session.metadata?.wallet_address;
        const tier = session.metadata?.tier || "pro";

        if (wallet) {
          // Set expiry 30 days out (Stripe will update via subscription.updated)
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);

          await supabase
            .from("ep_users")
            .update({
              subscription_tier: tier,
              subscription_status: "active",
              stripe_customer_id: session.customer as string,
              subscription_expires_at: expiresAt.toISOString(),
            })
            .eq("wallet_address", wallet);

          console.log(`Subscription activated: ${wallet} → ${tier}`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const status = subscription.status;
        const tier = subscription.metadata?.tier || "pro";

        // Map Stripe status to our status
        let epStatus: string;
        if (status === "active") epStatus = "active";
        else if (status === "trialing") epStatus = "trialing";
        else if (status === "past_due") epStatus = "past_due";
        else epStatus = "canceled";

        // Use Stripe's current_period_end for accurate expiry
        const subAny = subscription as any;
        const periodEnd = subAny.current_period_end
          ? new Date(subAny.current_period_end * 1000).toISOString()
          : null;

        // Find user by stripe customer ID
        const { data: user } = await supabase
          .from("ep_users")
          .select("wallet_address")
          .eq("stripe_customer_id", customerId)
          .single();

        if (user) {
          const updateData: Record<string, any> = {
            subscription_tier: epStatus === "canceled" ? "free" : tier,
            subscription_status: epStatus,
          };
          if (periodEnd) {
            updateData.subscription_expires_at = periodEnd;
          }

          await supabase
            .from("ep_users")
            .update(updateData)
            .eq("wallet_address", user.wallet_address);

          console.log(
            `Subscription updated: ${user.wallet_address} → ${tier} (${epStatus})`
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: user } = await supabase
          .from("ep_users")
          .select("wallet_address")
          .eq("stripe_customer_id", customerId)
          .single();

        if (user) {
          await supabase
            .from("ep_users")
            .update({
              subscription_tier: "free",
              subscription_status: "canceled",
              subscription_expires_at: null,
            })
            .eq("wallet_address", user.wallet_address);

          console.log(`Subscription canceled: ${user.wallet_address}`);
        }
        break;
      }

      default:
        // Unhandled event type
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Webhook error:", err);
    return NextResponse.json(
      { error: err.message || "Webhook handler failed" },
      { status: 500 }
    );
  }
}
