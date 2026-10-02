import Link from "next/link";
import { BookingRow } from "@/components/booking-row";
import { CopyLink } from "@/components/copy-link";
import { Card, EmptyState, Flash, PageHeader, SectionTitle } from "@/components/ui";
import { requireInstructor } from "@/lib/auth";
import { appUrl } from "@/lib/env";
import { formatGBP } from "@/lib/money";
import { addDays, localParts, zonedToUtc } from "@/lib/time";
import { amountDue, type Booking } from "@/lib/types";

export const metadata = { title: "Today" };

type Row = Booking & { student: { full_name: string } };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const params = await searchParams;
  const { supabase, instructor } = await requireInstructor();
  const tz = instructor.timezone;
  const today = localParts(new Date(), tz).date;

  const [upcoming, owed, rules] = await Promise.all([
    supabase
      .from("bookings")
      .select("*, student:profiles!bookings_student_id_fkey(full_name)")
      .eq("status", "confirmed")
      .gte("starts_at", zonedToUtc(today, "00:00", tz).toISOString())
      .lt("starts_at", zonedToUtc(addDays(today, 7), "00:00", tz).toISOString())
      .order("starts_at")
      .returns<Row[]>(),
    supabase.from("bookings").select("*").eq("payment_status", "unpaid").lt("starts_at", new Date().toISOString()).returns<Booking[]>(),
    supabase.from("availability_rules").select("id", { count: "exact", head: true }),
  ]);

  const outstanding = (owed.data ?? []).reduce((sum, b) => sum + amountDue(b), 0);
  const bookingLink = `${appUrl}/join/${instructor.slug}`;

  return (
    <>
      <PageHeader title="This week" subtitle="Your confirmed lessons for the next seven days." />
      <Flash searchParams={params} />

      {rules.count === 0 && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <p className="text-sm text-blue-900">
            Learners can&apos;t book yet. <Link href="/dashboard/availability" className="font-medium underline">Set your weekly availability</Link>{" "}
            and check your <Link href="/dashboard/settings" className="font-medium underline">prices and payment options</Link>.
          </p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle>Upcoming lessons</SectionTitle>
          {upcoming.data?.length ? (
            <ul className="divide-y divide-slate-100">
              {upcoming.data.map((b) => (
                <BookingRow
                  key={b.id}
                  booking={b}
                  tz={tz}
                  who={<Link href={`/dashboard/students/${b.student_id}`} className="hover:underline">{b.student.full_name}</Link>}
                />
              ))}
            </ul>
          ) : (
            <EmptyState>No lessons booked in the next seven days.</EmptyState>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <SectionTitle>Your booking link</SectionTitle>
            <p className="mb-3 text-sm text-slate-600">Send this to learners so they can sign up and book with you.</p>
            <CopyLink url={bookingLink} />
          </Card>
          <Card>
            <SectionTitle>Money owed</SectionTitle>
            <p className="text-2xl font-semibold text-slate-900">{formatGBP(outstanding)}</p>
            <p className="mt-1 text-sm text-slate-600">
              From past lessons and late cancellations. <Link href="/dashboard/bookings?filter=unpaid" className="underline">See unpaid</Link>
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
