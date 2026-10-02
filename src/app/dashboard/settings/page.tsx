import { Badge, Button, Card, Checkbox, Field, Flash, Input, PageHeader, SectionTitle, Select, Textarea } from "@/components/ui";
import { requireInstructor } from "@/lib/auth";
import { appUrl, features } from "@/lib/env";
import { describeLateFee } from "@/lib/money";
import {
  addSkill,
  connectStripe,
  deleteSkill,
  saveCancellationTerms,
  saveLessons,
  savePayments,
  saveProfile,
  toggleProgressTracking,
} from "./actions";

export const metadata = { title: "Settings" };

const pounds = (pence: number | null) => (pence == null ? "" : (pence / 100).toFixed(2));

export default async function SettingsPage({ searchParams }: PageProps<"/dashboard/settings">) {
  const params = await searchParams;
  const { supabase, profile, instructor: i } = await requireInstructor();

  const [{ data: terms }, { data: skills }] = await Promise.all([
    supabase.from("instructor_terms").select("body").eq("version", i.terms_version).maybeSingle<{ body: string }>(),
    supabase.from("skills").select("id, name").order("position").returns<{ id: string; name: string }[]>(),
  ]);

  return (
    <>
      <PageHeader title="Settings" />
      <Flash searchParams={params} />

      <div className="space-y-6">
        <Card>
          <SectionTitle>Profile</SectionTitle>
          <form action={saveProfile} className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input name="full_name" defaultValue={profile.full_name} required />
            </Field>
            <Field label="Mobile number">
              <Input name="phone" type="tel" defaultValue={profile.phone ?? ""} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Booking link" hint={`${appUrl}/join/…`}>
                <Input name="slug" defaultValue={i.slug} required />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="About you" hint="Shown on your booking page.">
                <Textarea name="bio" rows={3} defaultValue={i.bio ?? ""} />
              </Field>
            </div>
            <div>
              <Button>Save profile</Button>
            </div>
          </form>
        </Card>

        <Card>
          <SectionTitle>Lessons and booking rules</SectionTitle>
          <form action={saveLessons} className="grid gap-4 sm:grid-cols-2">
            <Field label="Hourly rate (£)">
              <Input name="hourly_rate" inputMode="decimal" defaultValue={pounds(i.hourly_rate_pence)} required />
            </Field>
            <fieldset>
              <legend className="mb-1 text-sm font-medium text-slate-800">Lesson lengths learners can book</legend>
              <div className="flex gap-4 pt-1">
                {[60, 90, 120].map((d) => (
                  <Checkbox key={d} name="lesson_durations" value={d} defaultChecked={i.lesson_durations.includes(d)} label={`${d / 60} hr${d > 60 ? "s" : ""}`} />
                ))}
              </div>
            </fieldset>
            <Field label="Start times every" hint="How often a lesson can start within your hours.">
              <Select name="slot_interval_minutes" defaultValue={i.slot_interval_minutes}>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>Hour</option>
              </Select>
            </Field>
            <Field label="Minimum notice (hours)" hint="Learners can't book later than this before a lesson.">
              <Input name="min_notice_hours" type="number" min={0} max={336} defaultValue={i.min_notice_hours} />
            </Field>
            <Field label="Bookable up to (days ahead)">
              <Input name="booking_window_days" type="number" min={1} max={180} defaultValue={i.booking_window_days} />
            </Field>
            <div className="sm:col-span-2">
              <Button>Save lesson settings</Button>
            </div>
          </form>
        </Card>

        <Card>
          <SectionTitle>How learners pay</SectionTitle>
          <form action={savePayments} className="space-y-5">
            <Checkbox name="accepts_cash" defaultChecked={i.accepts_cash} label="Cash on the day" />

            <div className="space-y-3">
              <Checkbox name="accepts_bank_transfer" defaultChecked={i.accepts_bank_transfer} label="Bank transfer (learners see your details after booking)" />
              <div className="grid gap-3 pl-6 sm:grid-cols-3">
                <Field label="Account name">
                  <Input name="bank_account_name" defaultValue={i.bank_account_name ?? ""} />
                </Field>
                <Field label="Sort code">
                  <Input name="bank_sort_code" inputMode="numeric" placeholder="12-34-56" defaultValue={i.bank_sort_code ?? ""} />
                </Field>
                <Field label="Account number">
                  <Input name="bank_account_number" inputMode="numeric" defaultValue={i.bank_account_number ?? ""} />
                </Field>
              </div>
            </div>

            <div className="space-y-2">
              <Checkbox
                name="accepts_stripe"
                defaultChecked={i.accepts_stripe}
                disabled={!features.stripe}
                label={
                  <>
                    Card payments online through Stripe{" "}
                    {i.stripe_charges_enabled ? <Badge tone="green">Connected</Badge> : <Badge>Not connected</Badge>}
                  </>
                }
              />
              {!features.stripe && <p className="pl-6 text-xs text-slate-500">Card payments are not set up on this site yet.</p>}
            </div>

            <Button>Save payment options</Button>
          </form>
          {features.stripe && !i.stripe_charges_enabled && (
            <form action={connectStripe} className="mt-4 border-t border-slate-100 pt-4">
              <Button variant="secondary">{i.stripe_account_id ? "Finish Stripe setup" : "Connect Stripe"}</Button>
            </form>
          )}
        </Card>

        <Card>
          <SectionTitle>Cancellations and terms</SectionTitle>
          <p className="mb-4 text-sm text-slate-600">
            Learners see this when booking:{" "}
            <em>
              {describeLateFee({
                noticeHours: i.cancellation_notice_hours,
                policy: i.late_fee_policy,
                fixedPence: i.late_fee_fixed_pence,
                percent: i.late_fee_percent,
              })}
            </em>
          </p>
          <form action={saveCancellationTerms} className="grid gap-4 sm:grid-cols-2">
            <Field label="Notice needed to cancel free (hours)">
              <Input name="cancellation_notice_hours" type="number" min={0} max={336} defaultValue={i.cancellation_notice_hours} />
            </Field>
            <Field label="Late cancellation charge">
              <Select name="late_fee_policy" defaultValue={i.late_fee_policy}>
                <option value="none">No charge</option>
                <option value="full">Full lesson price</option>
                <option value="fixed">Fixed fee</option>
                <option value="percent">Percentage of lesson price</option>
              </Select>
            </Field>
            <Field label="Fixed fee (£)" hint="Used when the charge is a fixed fee.">
              <Input name="late_fee_fixed" inputMode="decimal" defaultValue={pounds(i.late_fee_fixed_pence)} />
            </Field>
            <Field label="Percentage" hint="Used when the charge is a percentage.">
              <Input name="late_fee_percent" type="number" min={0} max={100} defaultValue={i.late_fee_percent ?? ""} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Your terms and conditions" hint={`Learners must accept these to book. Version ${i.terms_version || "none yet"}.`}>
                <Textarea name="terms" rows={8} defaultValue={terms?.body ?? ""} placeholder="For example: lessons start and end at the agreed pick-up point…" />
              </Field>
            </div>
            <div>
              <Button>Save cancellations and terms</Button>
            </div>
          </form>
        </Card>

        <Card>
          <SectionTitle>Progress checklist</SectionTitle>
          <form action={toggleProgressTracking} className="flex flex-wrap items-center gap-4">
            <Checkbox name="enabled" defaultChecked={i.progress_tracking_enabled} label="Track each learner's progress against a skills checklist" />
            <Button variant="secondary">Save</Button>
          </form>
          {i.progress_tracking_enabled && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <ul className="divide-y divide-slate-100">
                {(skills ?? []).map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-1.5 text-sm">
                    <span>{s.name}</span>
                    <form action={deleteSkill.bind(null, s.id)}>
                      <button className="text-red-700 hover:underline">Remove</button>
                    </form>
                  </li>
                ))}
              </ul>
              <form action={addSkill} className="mt-3 flex gap-2">
                <Input name="name" placeholder="Add a skill" />
                <Button variant="secondary">Add</Button>
              </form>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
