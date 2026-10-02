"use server";

import { redirect } from "next/navigation";
import { requireInstructor } from "@/lib/auth";
import { appUrl, features } from "@/lib/env";
import { redirectWith } from "@/lib/redirect";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export async function startSubscription() {
  const { profile, instructor } = await requireInstructor();
  if (!features.subscriptions) redirectWith("/dashboard/billing", "error", "Subscriptions are not set up on this site yet.");
  const stripe = getStripe();

  let customerId = instructor.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: profile.email, name: profile.full_name, metadata: { instructor_id: instructor.id } });
    customerId = customer.id;
    await createAdminClient().from("instructors").update({ stripe_customer_id: customerId }).eq("id", instructor.id);
  }

  // Keep any unused trial days when subscribing early.
  const trialEnd = Math.floor(new Date(instructor.trial_ends_at).getTime() / 1000);
  const trialStillRunning = trialEnd > Date.now() / 1000 + 48 * 3600;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: process.env.STRIPE_SUBSCRIPTION_PRICE_ID!, quantity: 1 }],
    subscription_data: {
      metadata: { instructor_id: instructor.id },
      ...(trialStillRunning ? { trial_end: trialEnd } : {}),
    },
    metadata: { instructor_id: instructor.id, kind: "subscription" },
    success_url: `${appUrl}/dashboard/billing?ok=${encodeURIComponent("Thanks, your subscription is set up.")}`,
    cancel_url: `${appUrl}/dashboard/billing`,
  });
  redirect(session.url!);
}

export async function openBillingPortal() {
  const { instructor } = await requireInstructor();
  if (!features.stripe || !instructor.stripe_customer_id) redirectWith("/dashboard/billing", "error", "No subscription to manage yet.");
  const session = await getStripe().billingPortal.sessions.create({
    customer: instructor.stripe_customer_id,
    return_url: `${appUrl}/dashboard/billing`,
  });
  redirect(session.url);
}
