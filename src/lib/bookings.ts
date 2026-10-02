import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { features } from "@/lib/env";
import { cancellationOutcome, lessonPrice } from "@/lib/money";
import { notifyBookingCancelled, notifyBookingConfirmed } from "@/lib/notify";
import { generateSlots, type AvailabilityRule, type Interval } from "@/lib/slots";
import { offeredPaymentMethods, type Booking, type Instructor, type PaymentMethod, type Profile } from "@/lib/types";

/**
 * Bookable start times for an instructor. Uses the service role because a
 * student needs to know when the instructor is busy without seeing other
 * students' bookings.
 */
export async function availableSlots(instructor: Instructor, durationMinutes: number, onlyDate?: string, now = new Date()) {
  const admin = createAdminClient();
  const horizon = new Date(now.getTime() + (instructor.booking_window_days + 2) * 86400_000).toISOString();

  const [rules, bookings, timeOff] = await Promise.all([
    admin.from("availability_rules").select("weekday, start_time, end_time").eq("instructor_id", instructor.id),
    admin
      .from("bookings")
      .select("starts_at, ends_at")
      .eq("instructor_id", instructor.id)
      .neq("status", "cancelled")
      .gte("ends_at", now.toISOString())
      .lte("starts_at", horizon),
    admin
      .from("time_off")
      .select("starts_at, ends_at")
      .eq("instructor_id", instructor.id)
      .gte("ends_at", now.toISOString())
      .lte("starts_at", horizon),
  ]);

  const toInterval = (r: { starts_at: string; ends_at: string }): Interval => ({
    start: new Date(r.starts_at),
    end: new Date(r.ends_at),
  });

  return generateSlots({
    rules: (rules.data ?? []) as AvailabilityRule[],
    busy: [...(bookings.data ?? []), ...(timeOff.data ?? [])].map(toInterval),
    durationMinutes,
    intervalMinutes: instructor.slot_interval_minutes,
    minNoticeHours: instructor.min_notice_hours,
    windowDays: instructor.booking_window_days,
    now,
    tz: instructor.timezone,
    onlyDate,
  });
}

type BookingRequest = {
  instructor: Instructor;
  student: Profile;
  startsAt: Date;
  durationMinutes: number;
  paymentMethod: PaymentMethod;
  termsVersion: number;
  pickupLocation?: string;
  notes?: string;
};

export class BookingError extends Error {}

/** Validates a request against the instructor's rules and books it instantly. */
export async function createBooking(req: BookingRequest): Promise<Booking> {
  const { instructor, student } = req;
  const admin = createAdminClient();

  const { data: link } = await admin
    .from("instructor_students")
    .select("student_id")
    .eq("instructor_id", instructor.id)
    .eq("student_id", student.id)
    .maybeSingle();
  if (!link) throw new BookingError("You need to join this instructor before booking.");

  if (!instructor.lesson_durations.includes(req.durationMinutes)) {
    throw new BookingError("That lesson length is not available.");
  }
  if (!offeredPaymentMethods(instructor, features.stripe).includes(req.paymentMethod)) {
    throw new BookingError("That payment method is not available.");
  }
  if (instructor.terms_version > 0 && req.termsVersion !== instructor.terms_version) {
    throw new BookingError("Your instructor has updated their terms. Please read and accept them again.");
  }

  const slots = await availableSlots(instructor, req.durationMinutes);
  if (!slots.some((s) => s.getTime() === req.startsAt.getTime())) {
    throw new BookingError("Sorry, that time is no longer available. Please pick another.");
  }

  const { data, error } = await admin
    .from("bookings")
    .insert({
      instructor_id: instructor.id,
      student_id: student.id,
      starts_at: req.startsAt.toISOString(),
      ends_at: new Date(req.startsAt.getTime() + req.durationMinutes * 60_000).toISOString(),
      price_pence: lessonPrice(instructor.hourly_rate_pence, req.durationMinutes),
      payment_method: req.paymentMethod,
      terms_version: instructor.terms_version,
      terms_accepted_at: new Date().toISOString(),
      pickup_location: req.pickupLocation || null,
      student_notes: req.notes || null,
    })
    .select("*")
    .single<Booking>();

  if (error) {
    // 23P01: exclusion constraint, someone else took the slot a moment ago.
    if (error.code === "23P01") throw new BookingError("Sorry, that time was just booked. Please pick another.");
    throw error;
  }

  const instructorProfile = await getProfile(admin, instructor.id);
  await notifyBookingConfirmed({ booking: data, student, instructor: instructorProfile, tz: instructor.timezone });
  return data;
}

/** Cancels a booking. Late fees only apply when the student cancels. */
export async function cancelBooking(bookingId: string, actor: Profile, reason?: string) {
  const admin = createAdminClient();
  const { data: booking } = await admin.from("bookings").select("*").eq("id", bookingId).single<Booking>();
  if (!booking) throw new BookingError("Booking not found.");

  const byInstructor = actor.id === booking.instructor_id;
  if (!byInstructor && actor.id !== booking.student_id) throw new BookingError("Booking not found.");
  if (booking.status !== "confirmed") throw new BookingError("This lesson can no longer be cancelled.");
  if (new Date(booking.starts_at) <= new Date()) throw new BookingError("This lesson has already started.");

  const { data: instructor } = await admin.from("instructors").select("*").eq("id", booking.instructor_id).single<Instructor>();
  if (!instructor) throw new BookingError("Instructor not found.");

  const outcome = byInstructor
    ? { late: false, feePence: 0 }
    : cancellationOutcome(new Date(booking.starts_at), new Date(), booking.price_pence, {
        noticeHours: instructor.cancellation_notice_hours,
        policy: instructor.late_fee_policy,
        fixedPence: instructor.late_fee_fixed_pence,
        percent: instructor.late_fee_percent,
      });

  const { data: updated, error } = await admin
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: actor.id,
      cancellation_reason: reason || null,
      late_cancellation: outcome.late,
      late_fee_pence: outcome.feePence,
      // Nothing is owed when there is no fee and the lesson was unpaid.
      payment_status: outcome.feePence === 0 && booking.payment_status === "unpaid" ? "waived" : booking.payment_status,
    })
    .eq("id", booking.id)
    .eq("status", "confirmed")
    .select("*")
    .single<Booking>();
  if (error) throw error;

  const [student, instructorProfile] = await Promise.all([
    getProfile(admin, booking.student_id),
    getProfile(admin, booking.instructor_id),
  ]);
  await notifyBookingCancelled(
    { booking: updated, student, instructor: instructorProfile, tz: instructor.timezone },
    byInstructor,
  );
  return updated;
}

export async function getProfile(admin: SupabaseClient, id: string): Promise<Profile> {
  const { data, error } = await admin.from("profiles").select("*").eq("id", id).single<Profile>();
  if (error) throw error;
  return data;
}
