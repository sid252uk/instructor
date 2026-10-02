"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireInstructor } from "@/lib/auth";
import { appUrl } from "@/lib/env";
import { sendEmail } from "@/lib/notify";
import { redirectWith } from "@/lib/redirect";

export async function inviteStudent(formData: FormData) {
  const { profile, instructor } = await requireInstructor();
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim());
  if (!email.success) redirectWith("/dashboard/students", "error", "Please enter a valid email address.");
  const name = String(formData.get("name") ?? "").trim();

  await sendEmail(
    email.data,
    `${profile.full_name} has invited you to book driving lessons`,
    `Hi${name ? ` ${name}` : ""},\n\n${profile.full_name} uses Instructor for lesson bookings. ` +
      `Create your account and book your first lesson here:\n\n${appUrl}/join/${instructor.slug}`,
  );
  redirectWith("/dashboard/students", "ok", `Invite sent to ${email.data}.`);
}

export async function removeStudent(studentId: string) {
  const { supabase, instructor } = await requireInstructor();
  await supabase.from("instructor_students").delete().eq("instructor_id", instructor.id).eq("student_id", studentId);
  revalidatePath("/dashboard/students");
  redirectWith("/dashboard/students", "ok", "Student removed. Their past bookings are kept.");
}

export async function saveProgress(studentId: string, formData: FormData) {
  const { supabase } = await requireInstructor();
  const rows = [...formData.entries()]
    .filter(([key]) => key.startsWith("skill:"))
    .map(([key, value]) => ({
      student_id: studentId,
      skill_id: key.slice("skill:".length),
      level: Math.max(0, Math.min(5, Number(value) || 0)),
      updated_at: new Date().toISOString(),
    }));

  const path = `/dashboard/students/${studentId}`;
  if (rows.length) {
    const { error } = await supabase.from("skill_progress").upsert(rows, { onConflict: "student_id,skill_id" });
    if (error) redirectWith(path, "error", error.message);
  }
  revalidatePath(path);
  redirectWith(path, "ok", "Progress saved.");
}
