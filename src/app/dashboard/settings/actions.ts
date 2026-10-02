"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireInstructor } from "@/lib/auth";
import { appUrl, features } from "@/lib/env";
import { parsePounds } from "@/lib/money";
import { redirectWith } from "@/lib/redirect";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

const PATH = "/dashboard/settings";

async function updateInstructor(patch: Record<string, unknown>, message: string) {
  const { instructor } = await requireInstructor();
  const { error } = await createAdminClient().from("instructors").update(patch).eq("id", instructor.id);
  if (error) {
    redirectWith(PATH, "error", error.code === "23505" ? "That booking link is already taken." : error.message);
  }
  revalidatePath("/dashboard", "layout");
  redirectWith(PATH, "ok", message);
}

const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

export async function saveProfile(formData: FormData) {
  const { supabase, user } = await requireInstructor();
  const parsed = z
    .object({
      full_name: z.string().trim().min(2, "Please enter your name."),
      phone: z.string().trim().max(20),
      bio: z.string().trim().max(500, "Keep your bio under 500 characters."),
      slug: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9][a-z0-9-]{2,39}$/, "Booking links use 3 to 40 lowercase letters, numbers and dashes."),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirectWith(PATH, "error", parsed.error.issues[0].message);

  await supabase.from("profiles").update({ full_name: parsed.data.full_name, phone: parsed.data.phone || null }).eq("id", user.id);
  await updateInstructor({ bio: parsed.data.bio || null, slug: parsed.data.slug }, "Profile saved.");
}

export async function saveLessons(formData: FormData) {
  const rate = parsePounds(String(formData.get("hourly_rate") ?? ""));
  if (rate === null) redirectWith(PATH, "error", "Please enter an hourly rate like 42.50.");
  const durations = formData
    .getAll("lesson_durations")
    .map(Number)
    .filter((d) => [60, 90, 120].includes(d))
    .sort((a, b) => a - b);
  if (!durations.length) redirectWith(PATH, "error", "Choose at least one lesson length.");

  const parsed = z
    .object({
      slot_interval_minutes: z.coerce.number().refine((v) => [15, 30, 60].includes(v)),
      min_notice_hours: int(0, 336),
      booking_window_days: int(1, 180),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirectWith(PATH, "error", "Please check your booking rules.");

  await updateInstructor({ hourly_rate_pence: rate, lesson_durations: durations, ...parsed.data }, "Lesson settings saved.");
}

export async function savePayments(formData: FormData) {
  const sortCode = String(formData.get("bank_sort_code") ?? "").replace(/\D/g, "");
  const accountNumber = String(formData.get("bank_account_number") ?? "").replace(/\D/g, "");
  const acceptsBank = formData.get("accepts_bank_transfer") === "on";
  const acceptsCash = formData.get("accepts_cash") === "on";
  const acceptsStripe = formData.get("accepts_stripe") === "on";

  if (acceptsBank && (sortCode.length !== 6 || accountNumber.length !== 8)) {
    redirectWith(PATH, "error", "UK bank details need a 6-digit sort code and an 8-digit account number.");
  }
  if (!acceptsBank && !acceptsCash && !acceptsStripe) redirectWith(PATH, "error", "Turn on at least one way to pay.");

  await updateInstructor(
    {
      accepts_cash: acceptsCash,
      accepts_bank_transfer: acceptsBank,
      accepts_stripe: acceptsStripe,
      bank_account_name: String(formData.get("bank_account_name") ?? "").trim() || null,
      bank_sort_code: sortCode ? `${sortCode.slice(0, 2)}-${sortCode.slice(2, 4)}-${sortCode.slice(4)}` : null,
      bank_account_number: accountNumber || null,
    },
    "Payment options saved.",
  );
}

export async function saveCancellationTerms(formData: FormData) {
  const { instructor } = await requireInstructor();
  const policy = String(formData.get("late_fee_policy"));
  if (!["none", "full", "fixed", "percent"].includes(policy)) redirectWith(PATH, "error", "Choose a late cancellation charge.");
  const notice = z.coerce.number().int().min(0).max(336).safeParse(formData.get("cancellation_notice_hours"));
  if (!notice.success) redirectWith(PATH, "error", "Notice must be between 0 and 336 hours.");

  const fixed = policy === "fixed" ? parsePounds(String(formData.get("late_fee_fixed") ?? "")) : null;
  if (policy === "fixed" && fixed === null) redirectWith(PATH, "error", "Enter the fixed fee, like 20.");
  const percent = policy === "percent" ? Number(formData.get("late_fee_percent")) : null;
  if (policy === "percent" && !(percent !== null && percent >= 0 && percent <= 100)) {
    redirectWith(PATH, "error", "Enter a percentage between 0 and 100.");
  }

  const terms = String(formData.get("terms") ?? "").trim();
  const admin = createAdminClient();
  const { data: current } = await admin
    .from("instructor_terms")
    .select("body")
    .eq("instructor_id", instructor.id)
    .eq("version", instructor.terms_version)
    .maybeSingle();

  // Changed terms become a new version; earlier bookings keep pointing at the
  // version the learner accepted.
  let termsVersion = instructor.terms_version;
  if (terms && terms !== current?.body) {
    termsVersion += 1;
    const { error } = await admin.from("instructor_terms").insert({ instructor_id: instructor.id, version: termsVersion, body: terms });
    if (error) redirectWith(PATH, "error", error.message);
  }

  await updateInstructor(
    {
      cancellation_notice_hours: notice.data,
      late_fee_policy: policy,
      late_fee_fixed_pence: fixed,
      late_fee_percent: percent,
      terms_version: termsVersion,
    },
    termsVersion !== instructor.terms_version ? "Saved. Learners will accept your new terms on their next booking." : "Cancellation policy saved.",
  );
}

const DEFAULT_SKILLS = [
  "Cockpit drill and controls",
  "Moving off and stopping",
  "Use of mirrors",
  "Signals",
  "Junctions: turning left and right",
  "Roundabouts",
  "Crossroads",
  "Meeting traffic and clearance",
  "Pedestrian crossings",
  "Dual carriageways",
  "Country roads",
  "Hill starts",
  "Emergency stop",
  "Reverse parking (bay)",
  "Parallel parking",
  "Pulling up on the right and reversing",
  "Independent driving and sat nav",
  "Awareness and planning",
];

export async function toggleProgressTracking(formData: FormData) {
  const { supabase, instructor } = await requireInstructor();
  const enabled = formData.get("enabled") === "on";
  if (enabled) {
    const { count } = await supabase.from("skills").select("id", { count: "exact", head: true });
    if (!count) {
      await supabase.from("skills").insert(DEFAULT_SKILLS.map((name, position) => ({ instructor_id: instructor.id, name, position })));
    }
  }
  await updateInstructor({ progress_tracking_enabled: enabled }, enabled ? "Progress checklist turned on." : "Progress checklist turned off.");
}

export async function addSkill(formData: FormData) {
  const { supabase, instructor } = await requireInstructor();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirectWith(PATH, "error", "Enter a skill name.");
  const { count } = await supabase.from("skills").select("id", { count: "exact", head: true });
  await supabase.from("skills").insert({ instructor_id: instructor.id, name, position: count ?? 0 });
  revalidatePath(PATH);
  redirectWith(PATH, "ok", "Skill added.");
}

export async function deleteSkill(id: string) {
  const { supabase } = await requireInstructor();
  await supabase.from("skills").delete().eq("id", id);
  revalidatePath(PATH);
}

/** Sends the instructor to Stripe to connect an account for card payments. */
export async function connectStripe() {
  const { profile, instructor } = await requireInstructor();
  if (!features.stripe) redirectWith(PATH, "error", "Card payments are not set up on this site yet.");
  const stripe = getStripe();

  let accountId = instructor.stripe_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "GB",
      email: profile.email,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      business_profile: { mcc: "8299", product_description: "Driving lessons" },
    });
    accountId = account.id;
    await createAdminClient().from("instructors").update({ stripe_account_id: accountId }).eq("id", instructor.id);
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${appUrl}/dashboard/settings/stripe`,
    return_url: `${appUrl}/dashboard/settings/stripe`,
  });
  redirect(link.url);
}
