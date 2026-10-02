"use server";

import { revalidatePath } from "next/cache";
import { requireInstructor } from "@/lib/auth";
import { redirectWith } from "@/lib/redirect";
import { zonedToUtc } from "@/lib/time";

const PATH = "/dashboard/availability";
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function addRule(formData: FormData) {
  const { supabase, instructor } = await requireInstructor();
  const weekdays = formData.getAll("weekday").map(Number);
  const start = String(formData.get("start_time"));
  const end = String(formData.get("end_time"));

  if (!weekdays.length || weekdays.some((d) => !(d >= 0 && d <= 6))) redirectWith(PATH, "error", "Pick at least one day.");
  if (!TIME.test(start) || !TIME.test(end) || end <= start) redirectWith(PATH, "error", "The end time must be after the start time.");

  const { error } = await supabase
    .from("availability_rules")
    .insert(weekdays.map((weekday) => ({ instructor_id: instructor.id, weekday, start_time: start, end_time: end })));
  if (error) redirectWith(PATH, "error", error.message);
  revalidatePath(PATH);
  redirectWith(PATH, "ok", "Availability added.");
}

export async function deleteRule(id: string) {
  const { supabase } = await requireInstructor();
  await supabase.from("availability_rules").delete().eq("id", id);
  revalidatePath(PATH);
}

export async function addTimeOff(formData: FormData) {
  const { supabase, instructor } = await requireInstructor();
  const from = String(formData.get("from_date"));
  const to = String(formData.get("to_date") || from);
  const reason = String(formData.get("reason") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) {
    redirectWith(PATH, "error", "Please choose valid dates.");
  }

  // Whole days off, from midnight on the first day to midnight after the last.
  const startsAt = zonedToUtc(from, "00:00", instructor.timezone);
  const [y, m, d] = to.split("-").map(Number);
  const dayAfter = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  const endsAt = zonedToUtc(dayAfter, "00:00", instructor.timezone);

  const { error } = await supabase.from("time_off").insert({
    instructor_id: instructor.id,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    reason: reason || null,
  });
  if (error) redirectWith(PATH, "error", error.message);
  revalidatePath(PATH);
  redirectWith(PATH, "ok", "Time off added. Existing lessons on those days are not cancelled automatically.");
}

export async function deleteTimeOff(id: string) {
  const { supabase } = await requireInstructor();
  await supabase.from("time_off").delete().eq("id", id);
  revalidatePath(PATH);
}
