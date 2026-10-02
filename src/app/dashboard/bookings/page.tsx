import Link from "next/link";
import { BookingRow } from "@/components/booking-row";
import { InstructorBookingActions } from "@/components/instructor-booking-actions";
import { Card, EmptyState, Flash, PageHeader } from "@/components/ui";
import { requireInstructor } from "@/lib/auth";
import type { Booking } from "@/lib/types";

export const metadata = { title: "Bookings" };

type Row = Booking & { student: { full_name: string } };

const FILTERS = {
  upcoming: "Upcoming",
  past: "Past",
  unpaid: "Unpaid",
  cancelled: "Cancelled",
} as const;
type Filter = keyof typeof FILTERS;

export default async function BookingsPage({ searchParams }: PageProps<"/dashboard/bookings">) {
  const params = await searchParams;
  const filter: Filter = typeof params.filter === "string" && params.filter in FILTERS ? (params.filter as Filter) : "upcoming";
  const { supabase, instructor } = await requireInstructor();
  const now = new Date().toISOString();

  let query = supabase.from("bookings").select("*, student:profiles!bookings_student_id_fkey(full_name)");
  if (filter === "upcoming") query = query.eq("status", "confirmed").gte("starts_at", now).order("starts_at");
  if (filter === "past") query = query.neq("status", "cancelled").lt("starts_at", now).order("starts_at", { ascending: false });
  if (filter === "unpaid") {
    query = query
      .eq("payment_status", "unpaid")
      .or(`status.neq.cancelled,late_fee_pence.gt.0`)
      .order("starts_at");
  }
  if (filter === "cancelled") query = query.eq("status", "cancelled").order("starts_at", { ascending: false });
  const { data: bookings } = await query.limit(200).returns<Row[]>();

  const returnTo = `/dashboard/bookings?filter=${filter}`;

  return (
    <>
      <PageHeader title="Bookings" />
      <Flash searchParams={params} />
      <nav className="mb-4 flex gap-1 overflow-x-auto">
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <Link
            key={f}
            href={`/dashboard/bookings?filter=${f}`}
            className={`rounded-full px-3 py-1 text-sm ${f === filter ? "bg-blue-700 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
          >
            {FILTERS[f]}
          </Link>
        ))}
      </nav>
      <Card>
        {bookings?.length ? (
          <ul className="divide-y divide-slate-100">
            {bookings.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                tz={instructor.timezone}
                who={<Link href={`/dashboard/students/${b.student_id}`} className="hover:underline">{b.student.full_name}</Link>}
                actions={<InstructorBookingActions booking={b} returnTo={returnTo} />}
              />
            ))}
          </ul>
        ) : (
          <EmptyState>Nothing here.</EmptyState>
        )}
      </Card>
    </>
  );
}
