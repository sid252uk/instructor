"use server";

import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { BookingError, cancelBooking } from "@/lib/bookings";
import { features } from "@/lib/env";
import { createLessonCheckout } from "@/lib/payments";
import { redirectWith } from "@/lib/redirect";
import { createAdminClient } from "@/lib/supabase/admin";
import { amountDue, type Booking, type Instructor } from "@/lib/types";

export async function studentCancel(id: string) {
  const { profile } = await requireStudent();
  let booking: Booking;
  try {
    booking = await cancelBooking(id, profile);
  } catch (e) {
    if (e instanceof BookingError) redirectWith(`/student/bookings/${id}`, "error", e.message);
    throw e;
  }
  redirectWith(
    `/student/bookings/${id}`,
    "ok",
    booking.late_fee_pence > 0 ? "Lesson cancelled. A late cancellation fee applies." : "Lesson cancelled.",
  );
}

export async function payByCard(id: string) {
  const { user, profile } = await requireStudent();
  const admin = createAdminClient();
  const { data: booking } = await admin.from("bookings").select("*").eq("id", id).eq("student_id", user.id).single<Booking>();
  if (!booking || amountDue(booking) === 0) redirectWith(`/student/bookings/${id}`, "error", "Nothing to pay.");
  const { data: instructor } = await admin.from("instructors").select("*").eq("id", booking.instructor_id).single<Instructor>();
  if (!features.stripe || !instructor?.stripe_charges_enabled) {
    redirectWith(`/student/bookings/${id}`, "error", "Card payments are not available for this instructor.");
  }
  redirect(await createLessonCheckout(booking, instructor, profile.email));
}
