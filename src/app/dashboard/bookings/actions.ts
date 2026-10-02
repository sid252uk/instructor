"use server";

import { revalidatePath } from "next/cache";
import { requireInstructor } from "@/lib/auth";
import { BookingError, cancelBooking } from "@/lib/bookings";
import { redirectWith } from "@/lib/redirect";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BookingStatus, PaymentStatus } from "@/lib/types";

async function updateOwnBooking(id: string, patch: { status?: BookingStatus; payment_status?: PaymentStatus }) {
  const { instructor } = await requireInstructor();
  const admin = createAdminClient();
  await admin.from("bookings").update(patch).eq("id", id).eq("instructor_id", instructor.id);
  revalidatePath("/dashboard", "layout");
}

export async function markPaid(id: string) {
  await updateOwnBooking(id, { payment_status: "paid" });
}

export async function markUnpaid(id: string) {
  await updateOwnBooking(id, { payment_status: "unpaid" });
}

export async function waivePayment(id: string) {
  await updateOwnBooking(id, { payment_status: "waived" });
}

export async function markCompleted(id: string) {
  await updateOwnBooking(id, { status: "completed" });
}

export async function markNoShow(id: string) {
  await updateOwnBooking(id, { status: "no_show" });
}

export async function instructorCancel(id: string, returnTo: string) {
  const { profile } = await requireInstructor();
  try {
    await cancelBooking(id, profile, "Cancelled by instructor");
  } catch (e) {
    if (e instanceof BookingError) redirectWith(returnTo, "error", e.message);
    throw e;
  }
  revalidatePath("/dashboard", "layout");
  redirectWith(returnTo, "ok", "Lesson cancelled and your learner has been told.");
}
