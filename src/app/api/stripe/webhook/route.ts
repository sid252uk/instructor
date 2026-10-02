import type Stripe from "stripe";
import { NextResponse, type NextRequest } from "next/server";
import { features } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionStatus } from "@/lib/types";

// Handles two kinds of Stripe events:
// - Connect events from instructors' accounts (lesson payments, account updates)
// - Platform events for instructors' own subscriptions
// Stripe signs each webhook endpoint with its own secret, so both are accepted.
export async function POST(request: NextRequest) {
  if (!features.stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 404 });

  const body = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(Boolean) as string[];

  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = getStripe().webhooks.constructEvent(body, signature, secret);
      break;
    } catch {
      // Try the next secret.
    }
  }
  if (!event) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

  const admin = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      if (session.metadata?.kind === "lesson" && session.payment_status === "paid" && session.metadata.booking_id) {
        await admin
          .from("bookings")
          .update({ payment_status: "paid" })
          .eq("id", session.metadata.booking_id)
          .eq("stripe_checkout_session_id", session.id);
      }
      if (session.metadata?.kind === "subscription" && session.metadata.instructor_id && typeof session.subscription === "string") {
        await admin
          .from("instructors")
          .update({ stripe_subscription_id: session.subscription })
          .eq("id", session.metadata.instructor_id);
      }
      break;
    }

    case "account.updated": {
      const account = event.data.object;
      await admin.from("instructors").update({ stripe_charges_enabled: account.charges_enabled }).eq("stripe_account_id", account.id);
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      await admin
        .from("instructors")
        .update({ subscription_status: mapStatus(sub.status), stripe_subscription_id: sub.id })
        .eq("stripe_customer_id", typeof sub.customer === "string" ? sub.customer : sub.customer.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}

function mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "past_due";
    default:
      return "cancelled";
  }
}
