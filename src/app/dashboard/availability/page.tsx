import { Button, Card, EmptyState, Field, Flash, Input, PageHeader, SectionTitle } from "@/components/ui";
import { requireInstructor } from "@/lib/auth";
import { formatDate, localParts, WEEKDAY_NAMES } from "@/lib/time";
import { addRule, addTimeOff, deleteRule, deleteTimeOff } from "./actions";

export const metadata = { title: "Availability" };

type Rule = { id: string; weekday: number; start_time: string; end_time: string };
type TimeOff = { id: string; starts_at: string; ends_at: string; reason: string | null };

// Monday first, as UK diaries usually are.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default async function AvailabilityPage({ searchParams }: PageProps<"/dashboard/availability">) {
  const params = await searchParams;
  const { supabase, instructor } = await requireInstructor();
  const tz = instructor.timezone;

  const [{ data: rules }, { data: timeOff }] = await Promise.all([
    supabase.from("availability_rules").select("*").order("start_time").returns<Rule[]>(),
    supabase.from("time_off").select("*").gte("ends_at", new Date().toISOString()).order("starts_at").returns<TimeOff[]>(),
  ]);

  return (
    <>
      <PageHeader
        title="Availability"
        subtitle="Learners can book any free time inside these hours, as long as it meets your notice and booking window settings."
      />
      <Flash searchParams={params} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Weekly hours</SectionTitle>
          <ul className="divide-y divide-slate-100">
            {WEEK_ORDER.map((day) => {
              const dayRules = (rules ?? []).filter((r) => r.weekday === day);
              return (
                <li key={day} className="flex items-start justify-between gap-4 py-2">
                  <span className="w-24 shrink-0 text-sm font-medium text-slate-800">{WEEKDAY_NAMES[day]}</span>
                  <div className="flex flex-1 flex-col items-end gap-1">
                    {dayRules.length === 0 && <span className="text-sm text-slate-400">Not available</span>}
                    {dayRules.map((r) => (
                      <form key={r.id} action={deleteRule.bind(null, r.id)} className="flex items-center gap-2 text-sm">
                        <span>
                          {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}
                        </span>
                        <button className="text-red-700 hover:underline" aria-label={`Remove ${WEEKDAY_NAMES[day]} ${r.start_time.slice(0, 5)}`}>
                          Remove
                        </button>
                      </form>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>

          <form action={addRule} className="mt-6 space-y-4 border-t border-slate-100 pt-4">
            <p className="text-sm font-medium text-slate-800">Add hours</p>
            <div className="flex flex-wrap gap-2">
              {WEEK_ORDER.map((day) => (
                <label key={day} className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-sm">
                  <input type="checkbox" name="weekday" value={day} defaultChecked={day >= 1 && day <= 5} />
                  {WEEKDAY_NAMES[day].slice(0, 3)}
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From">
                <Input type="time" name="start_time" defaultValue="09:00" step={900} required />
              </Field>
              <Field label="To">
                <Input type="time" name="end_time" defaultValue="17:00" step={900} required />
              </Field>
            </div>
            <Button>Add hours</Button>
          </form>
        </Card>

        <Card>
          <SectionTitle>Time off</SectionTitle>
          {timeOff?.length ? (
            <ul className="divide-y divide-slate-100">
              {timeOff.map((t) => {
                const from = localParts(new Date(t.starts_at), tz).date;
                const to = localParts(new Date(new Date(t.ends_at).getTime() - 1), tz).date;
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>
                      {formatDate(from, tz)}
                      {to !== from && ` to ${formatDate(to, tz)}`}
                      {t.reason && <span className="text-slate-500"> · {t.reason}</span>}
                    </span>
                    <form action={deleteTimeOff.bind(null, t.id)}>
                      <button className="text-red-700 hover:underline">Remove</button>
                    </form>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState>No time off booked.</EmptyState>
          )}

          <form action={addTimeOff} className="mt-6 space-y-4 border-t border-slate-100 pt-4">
            <p className="text-sm font-medium text-slate-800">Block out days</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First day">
                <Input type="date" name="from_date" required />
              </Field>
              <Field label="Last day">
                <Input type="date" name="to_date" />
              </Field>
            </div>
            <Field label="Note" hint="Only you see this.">
              <Input name="reason" placeholder="Holiday" />
            </Field>
            <Button>Add time off</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
