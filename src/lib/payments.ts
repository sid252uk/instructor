import "server-only";
import { appUrl } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/time";
import { amountDue, type Booking, type Instructor } from "@/lib/types";

/**
 * Card payment for a lesson (or a late cancellation fee). The charge is made
 * directly on the instructor's connected Stripe account, so the money is theirs.
 */
export async function createLessonCheckout(booking: Booking, instructor: Instructor, studentEmail: string) {
  if (!instructor.stripe_account_id) throw new Error("Instructor has no Stripe account");
  const amount = amountDue(booking);
  const label = booking.status === "cancelled" ? "Late cancellation fee" : "Driving lesson";

  const session = await getStripe().checkout.sessions.create(
    {
      mode: "payment",
      customer_email: studentEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: amount,
            product_data: { name: `${label}, ${formatDateTime(booking.starts_at, instructor.timezone)}` },
          },
        },
      ],
      metadata: { booking_id: booking.id, kind: "lesson" },
      payment_intent_data: { metadata: { booking_id: booking.id } },
      success_url: `${appUrl}/student/bookings/${booking.id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/student/bookings/${booking.id}`,
    },
    { stripeAccount: instructor.stripe_account_id },
  );

  await createAdminClient().from("bookings").update({ stripe_checkout_session_id: session.id }).eq("id", booking.id);
  return session.url!;
}

/** Marks a booking paid if the given Checkout session has been paid. */
export async function syncCheckoutSession(sessionId: string, stripeAccount: string) {
  const session = await getStripe().checkout.sessions.retrieve(sessionId, {}, { stripeAccount });
  const bookingId = session.metadata?.booking_id;
  if (!bookingId || session.payment_status !== "paid") return false;
  await createAdminClient()
    .from("bookings")
    .update({ payment_status: "paid" })
    .eq("id", bookingId)
    .eq("stripe_checkout_session_id", sessionId);
  return true;
}
