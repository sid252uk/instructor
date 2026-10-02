import { notFound } from "next/navigation";
import { BookingRow } from "@/components/booking-row";
import { InstructorBookingActions } from "@/components/instructor-booking-actions";
import { Button, Card, EmptyState, Flash, PageHeader, SectionTitle, Select } from "@/components/ui";
import { requireInstructor } from "@/lib/auth";
import { formatGBP } from "@/lib/money";
import { amountDue, SKILL_LEVELS, type Booking, type Profile } from "@/lib/types";
import { removeStudent, saveProgress } from "../actions";

export const metadata = { title: "Student" };

export default async function StudentPage({ params, searchParams }: PageProps<"/dashboard/students/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase, instructor } = await requireInstructor();

  const { data: student } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle<Profile>();
  if (!student) notFound();

  const [{ data: bookings }, { data: skills }, { data: progress }] = await Promise.all([
    supabase.from("bookings").select("*").eq("student_id", id).order("starts_at", { ascending: false }).returns<Booking[]>(),
    supabase.from("skills").select("id, name").order("position").returns<{ id: string; name: string }[]>(),
    supabase.from("skill_progress").select("skill_id, level").eq("student_id", id).returns<{ skill_id: string; level: number }[]>(),
  ]);

  const levels = new Map((progress ?? []).map((p) => [p.skill_id, p.level]));
  const owed = (bookings ?? []).reduce((sum, b) => sum + amountDue(b), 0);
  const hours = (bookings ?? [])
    .filter((b) => b.status === "completed")
    .reduce((sum, b) => sum + (new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 3600_000, 0);
  const returnTo = `/dashboard/students/${id}`;

  return (
    <>
      <PageHeader
        title={student.full_name}
        subtitle={
          <>
            {student.email}
            {student.phone && ` · ${student.phone}`} · {hours} hours completed · {formatGBP(owed)} owed
          </>
        }
      />
      <Flash searchParams={query} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Lessons</SectionTitle>
          {bookings?.length ? (
            <ul className="divide-y divide-slate-100">
              {bookings.map((b) => (
                <BookingRow key={b.id} booking={b} tz={instructor.timezone} who={student.full_name} actions={<InstructorBookingActions booking={b} returnTo={returnTo} />} />
              ))}
            </ul>
          ) : (
            <EmptyState>No lessons yet.</EmptyState>
          )}
        </Card>

        {instructor.progress_tracking_enabled && (
          <Card>
            <SectionTitle>Progress</SectionTitle>
            {skills?.length ? (
              <form action={saveProgress.bind(null, id)} className="space-y-3">
                {skills.map((s) => (
                  <label key={s.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-800">{s.name}</span>
                    <span className="w-44 shrink-0">
                      <Select name={`skill:${s.id}`} defaultValue={levels.get(s.id) ?? 0}>
                        {SKILL_LEVELS.map((label, level) => (
                          <option key={level} value={level}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </span>
                  </label>
                ))}
                <Button>Save progress</Button>
              </form>
            ) : (
              <EmptyState>Add skills to your checklist in Settings.</EmptyState>
            )}
          </Card>
        )}
      </div>

      <form action={removeStudent.bind(null, id)} className="mt-8">
        <Button variant="danger">Remove student</Button>
      </form>
    </>
  );
}
