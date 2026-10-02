import { instructorCancel, markCompleted, markNoShow, markPaid, markUnpaid, waivePayment } from "@/app/dashboard/bookings/actions";
import { amountDue, type Booking } from "@/lib/types";

const linkButton = "rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50";

export function InstructorBookingActions({ booking, returnTo }: { booking: Booking; returnTo: string }) {
  const started = new Date(booking.starts_at) <= new Date();
  const due = amountDue(booking);
  return (
    <>
      {due > 0 && (
        <form action={markPaid.bind(null, booking.id)}>
          <button className={linkButton}>Mark paid</button>
        </form>
      )}
      {due > 0 && booking.status === "cancelled" && (
        <form action={waivePayment.bind(null, booking.id)}>
          <button className={linkButton}>Waive fee</button>
        </form>
      )}
      {booking.payment_status === "paid" && booking.payment_method !== "stripe" && (
        <form action={markUnpaid.bind(null, booking.id)}>
          <button className={linkButton}>Mark unpaid</button>
        </form>
      )}
      {booking.status === "confirmed" && started && (
        <>
          <form action={markCompleted.bind(null, booking.id)}>
            <button className={linkButton}>Completed</button>
          </form>
          <form action={markNoShow.bind(null, booking.id)}>
            <button className={linkButton}>No show</button>
          </form>
        </>
      )}
      {booking.status === "confirmed" && !started && (
        <form action={instructorCancel.bind(null, booking.id, returnTo)}>
          <button className={`${linkButton} border-red-300 text-red-700`}>Cancel</button>
        </form>
      )}
    </>
  );
}
