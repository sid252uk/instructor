"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { appUrl } from "@/lib/env";
import { getSession, homeFor } from "@/lib/auth";
import { redirectWith } from "@/lib/redirect";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

const safeNext = (value: FormDataEntryValue | null) => {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : null;
};

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    redirectWith(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`, "error", "Email or password is incorrect.");
  }
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single<Profile>();
  redirect(next ?? homeFor(profile));
}

const signUpSchema = z.object({
  full_name: z.string().trim().min(2, "Please enter your full name."),
  email: z.email("Please enter a valid email address."),
  phone: z.string().trim().max(20).optional(),
  password: z.string().min(8, "Passwords need at least 8 characters."),
});

async function signUp(formData: FormData, role: "instructor" | "student", backTo: string, joinSlug?: string) {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirectWith(backTo, "error", parsed.error.issues[0].message);
  const { full_name, email, phone, password } = parsed.data;
  const home = role === "instructor" ? "/dashboard" : "/student";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, full_name, phone: phone || null, join_slug: joinSlug ?? null },
      emailRedirectTo: `${appUrl}/auth/confirm?next=${home}`,
    },
  });
  if (error) redirectWith(backTo, "error", error.message);

  // When email confirmation is switched off in Supabase there is a session already.
  if (data.session) redirect(home);
  redirectWith("/login", "ok", "Check your email to confirm your account, then sign in.");
}

export async function signUpInstructor(formData: FormData) {
  await signUp(formData, "instructor", "/signup");
}

export async function signUpStudent(slug: string, formData: FormData) {
  await signUp(formData, "student", `/join/${slug}`, slug);
}

/** Links an already signed-in student to another instructor. */
export async function joinInstructor(slug: string) {
  const { user, profile } = await getSession();
  if (!user || !profile) redirect(`/login?next=/join/${slug}`);
  if (profile.role !== "student") redirectWith(`/join/${slug}`, "error", "Instructor accounts cannot join as a student.");

  const admin = createAdminClient();
  const { data: instructor } = await admin.from("instructors").select("id").eq("slug", slug).maybeSingle();
  if (!instructor) redirectWith("/student", "error", "That booking link is not valid.");

  await admin
    .from("instructor_students")
    .upsert({ instructor_id: instructor.id, student_id: user.id }, { onConflict: "instructor_id,student_id", ignoreDuplicates: true });
  redirect(`/student/book/${slug}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
