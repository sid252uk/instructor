import { redirect } from "next/navigation";
import { requireInstructor } from "@/lib/auth";
import { features } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Stripe sends instructors back here after onboarding. We check whether the
// account can take payments yet and record it.
export default async function StripeReturnPage() {
  const { instructor } = await requireInstructor();
  if (!features.stripe || !instructor.stripe_account_id) redirect("/dashboard/settings");

  const account = await getStripe().accounts.retrieve(instructor.stripe_account_id);
  await createAdminClient()
    .from("instructors")
    .update({ stripe_charges_enabled: account.charges_enabled, accepts_stripe: account.charges_enabled || instructor.accepts_stripe })
    .eq("id", instructor.id);

  const message = account.charges_enabled
    ? "Stripe is connected. Learners can now pay by card."
    : "Stripe still needs a few details before you can take card payments.";
  redirect(`/dashboard/settings?${account.charges_enabled ? "ok" : "error"}=${encodeURIComponent(message)}`);
}
