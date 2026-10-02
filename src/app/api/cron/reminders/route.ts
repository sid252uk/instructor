import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/bookings";
import { notifyLessonReminder } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking } from "@/lib/types";

// Sends a reminder for lessons starting in the next 24 hours. Run it on a
// schedule (see vercel.json); the reminder log stops repeats.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const { data: bookings } = await admin
    .from("bookings")
    .select("*, instructor:instructors(timezone)")
    .eq("status", "confirmed")
    .gt("starts_at", now.toISOString())
    .lte("starts_at", new Date(now.getTime() + 24 * 3600_000).toISOString())
    .returns<(Booking & { instructor: { timezone: string } })[]>();

  let sent = 0;
  for (const booking of bookings ?? []) {
    // Claim the reminder first so overlapping runs never double-send.
    const { error } = await admin.from("reminder_log").insert({ booking_id: booking.id, kind: "24h", channel: "all" });
    if (error) continue;
    const [student, instructor] = await Promise.all([getProfile(admin, booking.student_id), getProfile(admin, booking.instructor_id)]);
    await notifyLessonReminder({ booking, student, instructor, tz: booking.instructor.timezone });
    sent++;
  }

  return NextResponse.json({ sent });
}
