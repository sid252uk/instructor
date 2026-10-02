import { notFound } from "next/navigation";
import { StatusBadges } from "@/components/booking-row";
import { Button, Card, Flash, PageHeader, SectionTitle } from "@/components/ui";
import { requireStudent } from "@/lib/auth";
import { features } from "@/lib/env";
import { cancellationOutcome, formatGBP } from "@/lib/money";
import { syncCheckoutSession } from "@/lib/payments";
import { formatDateTime, formatTime } from "@/lib/time";
import { amountDue, PAYMENT_METHOD_LABELS, paymentReference, type Booking, type Instructor } from "@/lib/types";
import { payByCard, studentCancel } from "./actions";

export const metadata = { title: "Lesson" };

export default async function StudentBookingPage({ params, searchParams }: PageProps<"/student/bookings/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase, user } = await requireStudent();

  const load = () =>
    supabase
      .from("bookings")
      .select("*, instructor:instructors(*, profile:profiles!instructors_id_fkey(full_name, phone))")
      .eq("id", id)
      .eq("student_id", user.id)
      .maybeSingle<Booking & { instructor: Instructor & { profile: { full_name: string; phone: string | null } } }>();

  let { data: booking } = await load();
  if (!booking) notFound();
  const { instructor } = booking;

  // Back from Stripe Checkout: confirm the payment straight away rather than
  // waiting for the webhook.
  if (typeof query.session_id === "string" && features.stripe && instructor.stripe_account_id && booking.payment_status === "unpaid") {
    if (await syncCheckoutSession(query.session_id, instructor.stripe_account_id)) booking = (await load()).data!;
  }

  const tz = instructor.timezone;
  const due = amountDue(booking);
  const upcoming = booking.status === "confirmed" && new Date(booking.starts_at) > new Date();
  const ifCancelledNow = cancellationOutcome(new Date(booking.starts_at), new Date(), booking.price_pence, {
    noticeHours: instructor.cancellation_notice_hours,
    policy: instructor.late_fee_policy,
    fixedPence: instructor.late_fee_fixed_pence,
    percent: instructor.late_fee_percent,
  });
  const canPayByCard = features.stripe && instructor.stripe_charges_enabled;

  return (
    <>
      <PageHeader
        title={`${formatDateTime(booking.starts_at, tz)}–${formatTime(booking.ends_at, tz)}`}
        subtitle={`Driving lesson with ${instructor.profile.full_name}`}
      />
      <Flash searchParams={query} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-2 text-sm">
          <SectionTitle>Details</SectionTitle>
          <StatusBadges booking={booking} />
          <p>Price: {formatGBP(booking.price_pence)}</p>
          <p>Payment: {PAYMENT_METHOD_LABELS[booking.payment_method]}</p>
          {booking.pickup_location && <p>Pick-up: {booking.pickup_location}</p>}
          {instructor.profile.phone && (
            <p>
              Instructor: <a className="text-blue-700 underline" href={`tel:${instructor.profile.phone}`}>{instructor.profile.phone}</a>
            </p>
          )}
        </Card>

        {due > 0 && (
          <Card className="space-y-3 text-sm">
            <SectionTitle>{booking.status === "cancelled" ? "Late cancellation fee" : "Payment"}: {formatGBP(due)}</SectionTitle>
            {booking.payment_method === "bank_transfer" && instructor.bank_account_number && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg bg-slate-50 p-3">
                <dt className="text-slate-500">Name</dt>
                <dd>{instructor.bank_account_name}</dd>
                <dt className="text-slate-500">Sort code</dt>
                <dd>{instructor.bank_sort_code}</dd>
                <dt className="text-slate-500">Account</dt>
                <dd>{instructor.bank_account_number}</dd>
                <dt className="text-slate-500">Reference</dt>
                <dd className="font-mono">{paymentReference(booking)}</dd>
              </dl>
            )}
            {booking.payment_method === "cash" && booking.status !== "cancelled" && <p>Please pay your instructor in cash at the lesson.</p>}
            {booking.payment_method !== "stripe" && <p className="text-slate-600">Your instructor will mark this as paid once they receive it.</p>}
            {canPayByCard && (
              <form action={payByCard.bind(null, booking.id)}>
                <Button>Pay {formatGBP(due)} by card</Button>
              </form>
            )}
          </Card>
        )}

        {upcoming && (
          <Card className="space-y-3 text-sm">
            <SectionTitle>Cancel this lesson</SectionTitle>
            <p>
              {ifCancelledNow.late
                ? ifCancelledNow.feePence > 0
                  ? `It's within ${instructor.cancellation_notice_hours} hours of your lesson, so a late cancellation fee of ${formatGBP(ifCancelledNow.feePence)} applies.`
                  : `It's within ${instructor.cancellation_notice_hours} hours of your lesson. There's no charge, but please give more notice next time.`
                : "You can cancel free of charge."}
              {booking.payment_status === "paid" && " Your instructor will sort out any refund with you."}
            </p>
            <form action={studentCancel.bind(null, booking.id)}>
              <Button variant="danger">Cancel lesson</Button>
            </form>
          </Card>
        )}
      </div>
    </>
  );
}
