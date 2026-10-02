"use server";

import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { BookingError, createBooking } from "@/lib/bookings";
import { createLessonCheckout } from "@/lib/payments";
import { redirectWith } from "@/lib/redirect";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Instructor, PaymentMethod } from "@/lib/types";

export async function bookLesson(slug: string, formData: FormData) {
  const { profile } = await requireStudent();
  const duration = Number(formData.get("duration"));
  const date = String(formData.get("date") ?? "");
  const back = `/student/book/${slug}?duration=${duration}${date ? `&date=${date}` : ""}`;

  const startsAtRaw = String(formData.get("starts_at") ?? "");
  const startsAt = new Date(startsAtRaw);
  if (!startsAtRaw || Number.isNaN(startsAt.getTime())) redirectWith(back, "error", "Please pick a time.");
  if (formData.get("accept_terms") !== "on") redirectWith(back, "error", "Please accept the terms to book.");

  const { data: instructor } = await createAdminClient().from("instructors").select("*").eq("slug", slug).single<Instructor>();
  if (!instructor) redirectWith("/student", "error", "Instructor not found.");

  let booking;
  try {
    booking = await createBooking({
      instructor,
      student: profile,
      startsAt,
      durationMinutes: duration,
      paymentMethod: String(formData.get("payment_method")) as PaymentMethod,
      termsVersion: Number(formData.get("terms_version")),
      pickupLocation: String(formData.get("pickup_location") ?? "").trim(),
      notes: String(formData.get("notes") ?? "").trim(),
    });
  } catch (e) {
    if (e instanceof BookingError) redirectWith(back, "error", e.message);
    throw e;
  }

  if (booking.payment_method === "stripe") {
    redirect(await createLessonCheckout(booking, instructor, profile.email));
  }
  redirectWith(`/student/bookings/${booking.id}`, "ok", "Your lesson is booked.");
}
