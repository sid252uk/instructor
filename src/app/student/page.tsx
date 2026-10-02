import Link from "next/link";
import { BookingRow } from "@/components/booking-row";
import { ButtonLink, Card, EmptyState, Flash, PageHeader, SectionTitle } from "@/components/ui";
import { requireStudent } from "@/lib/auth";
import { DEFAULT_TZ } from "@/lib/time";
import type { Booking } from "@/lib/types";

export const metadata = { title: "My lessons" };

type InstructorRow = {
  instructor: { slug: string; progress_tracking_enabled: boolean; profile: { full_name: string } };
};
type Row = Booking & { instructor: { profile: { full_name: string } } };

export default async function StudentHome({ searchParams }: PageProps<"/student">) {
  const params = await searchParams;
  const { supabase, user } = await requireStudent();
  const now = new Date().toISOString();

  const [{ data: instructors }, { data: upcoming }, { data: past }] = await Promise.all([
    supabase
      .from("instructor_students")
      .select("instructor:instructors(slug, progress_tracking_enabled, profile:profiles!instructors_id_fkey(full_name))")
      .eq("student_id", user.id)
      .returns<InstructorRow[]>(),
    supabase
      .from("bookings")
      .select("*, instructor:instructors(profile:profiles!instructors_id_fkey(full_name))")
      .eq("student_id", user.id)
      .eq("status", "confirmed")
      .gte("starts_at", now)
      .order("starts_at")
      .returns<Row[]>(),
    supabase
      .from("bookings")
      .select("*, instructor:instructors(profile:profiles!instructors_id_fkey(full_name))")
      .eq("student_id", user.id)
      .or(`starts_at.lt.${now},status.eq.cancelled`)
      .order("starts_at", { ascending: false })
      .limit(20)
      .returns<Row[]>(),
  ]);

  const lessonLink = (b: Row) => (
    <Link href={`/student/bookings/${b.id}`} className="hover:underline">
      with {b.instructor.profile.full_name}
    </Link>
  );

  return (
    <>
      <PageHeader title="My lessons" />
      <Flash searchParams={params} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <SectionTitle>Upcoming</SectionTitle>
            {upcoming?.length ? (
              <ul className="divide-y divide-slate-100">
                {upcoming.map((b) => (
                  <BookingRow
                    key={b.id}
                    booking={b}
                    tz={DEFAULT_TZ}
                    who={lessonLink(b)}
                    actions={<ButtonLink href={`/student/bookings/${b.id}`} variant="secondary">View</ButtonLink>}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState>No lessons booked.</EmptyState>
            )}
          </Card>
          {!!past?.length && (
            <Card>
              <SectionTitle>Past and cancelled</SectionTitle>
              <ul className="divide-y divide-slate-100">
                {past.map((b) => (
                  <BookingRow key={b.id} booking={b} tz={DEFAULT_TZ} who={lessonLink(b)} />
                ))}
              </ul>
            </Card>
          )}
        </div>

        <Card>
          <SectionTitle>My instructors</SectionTitle>
          {instructors?.length ? (
            <ul className="space-y-4">
              {instructors.map(({ instructor }) => (
                <li key={instructor.slug}>
                  <p className="font-medium text-slate-900">{instructor.profile.full_name}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <ButtonLink href={`/student/book/${instructor.slug}`}>Book a lesson</ButtonLink>
                    {instructor.progress_tracking_enabled && (
                      <ButtonLink href={`/student/progress/${instructor.slug}`} variant="secondary">
                        My progress
                      </ButtonLink>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Ask your instructor for their booking link to get started.</EmptyState>
          )}
        </Card>
      </div>
    </>
  );
}
