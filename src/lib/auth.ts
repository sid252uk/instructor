import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Instructor, Profile } from "@/lib/types";

export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  return { supabase, user, profile };
}

export async function requireInstructor() {
  const { supabase, user, profile } = await getSession();
  if (!user || !profile) redirect("/login");
  if (profile.role !== "instructor") redirect("/student");
  const { data: instructor } = await supabase.from("instructors").select("*").eq("id", user.id).single<Instructor>();
  if (!instructor) redirect("/login");
  return { supabase, user, profile, instructor };
}

export async function requireStudent() {
  const { supabase, user, profile } = await getSession();
  if (!user || !profile) redirect("/login");
  if (profile.role !== "student") redirect("/dashboard");
  return { supabase, user, profile };
}

export function homeFor(profile: Profile | null) {
  return profile?.role === "instructor" ? "/dashboard" : "/student";
}
