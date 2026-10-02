import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Card, Checkbox, EmptyState, Field, Flash, Input, PageHeader, SectionTitle, Textarea } from "@/components/ui";
import { requireStudent } from "@/lib/auth";
import { availableSlots } from "@/lib/bookings";
import { features } from "@/lib/env";
import { describeLateFee, formatGBP, lessonPrice } from "@/lib/money";
import { groupByDate } from "@/lib/slots";
import { formatDate, formatTime } from "@/lib/time";
import { offeredPaymentMethods, PAYMENT_METHOD_LABELS, type Instructor } from "@/lib/types";
import { bookLesson } from "./actions";

export const metadata = { title: "Book a lesson" };

const chip = (active: boolean) =>
  `rounded-full px-3 py-1.5 text-sm whitespace-nowrap ${active ? "bg-blue-700 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"}`;

export default async function BookPage({ params, searchParams }: PageProps<"/student/book/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;
  const { supabase } = await requireStudent();

  // Row level security only shows instructors this learner has joined.
  const { data: instructor } = await supabase
    .from("instructors")
    .select("*, profile:profiles!instructors_id_fkey(full_name)")
    .eq("slug", slug)
    .maybeSingle<Instructor & { profile: { full_name: string } }>();
  if (!instructor) redirect(`/join/${slug}`);

  const tz = instructor.timezone;
  const durations = instructor.lesson_durations;
  const duration = durations.includes(Number(query.duration)) ? Number(query.duration) : durations[0];
  const slots = await availableSlots(instructor, duration);
  const byDate = groupByDate(slots, tz);
  const dates = [...byDate.keys()];
  const date = typeof query.date === "string" && byDate.has(query.date) ? query.date : dates[0];
  const times = date ? byDate.get(date)! : [];

  const methods = offeredPaymentMethods(instructor, features.stripe);
  const { data: terms } = await supabase
    .from("instructor_terms")
    .select("body")
    .eq("instructor_id", instructor.id)
    .eq("version", instructor.terms_version)
    .maybeSingle<{ body: string }>();
  const lateFee = describeLateFee({
    noticeHours: instructor.cancellation_notice_hours,
    policy: instructor.late_fee_policy,
    fixedPence: instructor.late_fee_fixed_pence,
    percent: instructor.late_fee_percent,
  });

  const href = (d: number, day?: string) => `/student/book/${slug}?duration=${d}${day ? `&date=${day}` : ""}`;

  return (
    <>
      <PageHeader title={`Book with ${instructor.profile.full_name}`} subtitle={`${formatGBP(instructor.hourly_rate_pence)} per hour`} />
      <Flash searchParams={query} />

      <Card className="mb-4">
        <SectionTitle>Lesson length</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {durations.map((d) => (
            <Link key={d} href={href(d)} className={chip(d === duration)}>
              {d / 60} hour{d > 60 ? "s" : ""} · {formatGBP(lessonPrice(instructor.hourly_rate_pence, d))}
            </Link>
          ))}
        </div>
      </Card>

      {!dates.length ? (
        <EmptyState>No times are free in the next {instructor.booking_window_days} days. Please check back later.</EmptyState>
      ) : methods.length === 0 ? (
        <EmptyState>Your instructor hasn&apos;t set up how to pay yet, so bookings are paused.</EmptyState>
      ) : (
        <form action={bookLesson.bind(null, slug)} className="space-y-4">
          <input type="hidden" name="duration" value={duration} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="terms_version" value={instructor.terms_version} />

          <Card>
            <SectionTitle>Day</SectionTitle>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {dates.map((d) => (
                <Link key={d} href={href(duration, d)} className={chip(d === date)} scroll={false}>
                  {formatDate(d, tz)}
                </Link>
              ))}
            </div>

            <h3 className="mt-5 mb-2 text-sm font-medium text-slate-800">Start time on {formatDate(date, tz)}</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {times.map((t, idx) => (
                <label key={t.toISOString()} className="cursor-pointer">
                  <input type="radio" name="starts_at" value={t.toISOString()} className="peer sr-only" required defaultChecked={idx === 0 && times.length === 1} />
                  <span className="block rounded-lg border border-slate-300 py-2 text-center text-sm peer-checked:border-blue-700 peer-checked:bg-blue-700 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-blue-600">
                    {formatTime(t, tz)}
                  </span>
                </label>
              ))}
            </div>
          </Card>

          <Card className="space-y-4">
            <SectionTitle>Details</SectionTitle>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-800">How will you pay?</legend>
              <div className="space-y-2">
                {methods.map((m, idx) => (
                  <label key={m} className="flex items-center gap-2 text-sm">
                    <input type="radio" name="payment_method" value={m} defaultChecked={idx === 0} required />
                    {PAYMENT_METHOD_LABELS[m]}
                    {m === "stripe" && <span className="text-slate-500">· pay now</span>}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Pick-up address" hint="Optional if your instructor already knows it.">
              <Input name="pickup_location" autoComplete="street-address" />
            </Field>
            <Field label="Anything your instructor should know?">
              <Textarea name="notes" rows={2} />
            </Field>
          </Card>

          <Card className="space-y-3">
            <SectionTitle>Cancellations and terms</SectionTitle>
            <p className="text-sm text-slate-700">{lateFee}</p>
            {terms?.body && (
              <details className="rounded-lg bg-slate-50 p-3 text-sm">
                <summary className="cursor-pointer font-medium text-slate-800">Read {instructor.profile.full_name}&apos;s terms</summary>
                <p className="mt-2 whitespace-pre-wrap text-slate-700">{terms.body}</p>
              </details>
            )}
            <Checkbox name="accept_terms" required label="I accept the cancellation policy and terms" />
          </Card>

          <Button className="w-full sm:w-auto">Book lesson · {formatGBP(lessonPrice(instructor.hourly_rate_pence, duration))}</Button>
        </form>
      )}
    </>
  );
}
