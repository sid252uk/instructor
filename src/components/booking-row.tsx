import type { ReactNode } from "react";
import { Badge } from "@/components/ui";
import { formatGBP } from "@/lib/money";
import { formatDateTime, formatTime } from "@/lib/time";
import { amountDue, PAYMENT_METHOD_LABELS, type Booking } from "@/lib/types";

export function StatusBadges({ booking }: { booking: Booking }) {
  const due = amountDue(booking);
  return (
    <span className="flex flex-wrap gap-1">
      {booking.status === "cancelled" && <Badge tone="red">{booking.late_cancellation ? "Late cancel" : "Cancelled"}</Badge>}
      {booking.status === "completed" && <Badge tone="green">Completed</Badge>}
      {booking.status === "no_show" && <Badge tone="red">No show</Badge>}
      {booking.payment_status === "paid" && <Badge tone="green">Paid</Badge>}
      {due > 0 && <Badge tone="amber">{formatGBP(due)} due</Badge>}
    </span>
  );
}

export function BookingRow({
  booking,
  who,
  tz,
  actions,
}: {
  booking: Booking;
  who: ReactNode;
  tz: string;
  actions?: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="font-medium text-slate-900">
          {formatDateTime(booking.starts_at, tz)}–{formatTime(booking.ends_at, tz)}
        </p>
        <p className="text-sm text-slate-600">
          {who} · {formatGBP(booking.price_pence)} · {PAYMENT_METHOD_LABELS[booking.payment_method]}
        </p>
        {booking.pickup_location && <p className="text-sm text-slate-500">Pick up: {booking.pickup_location}</p>}
        <div className="mt-1">
          <StatusBadges booking={booking} />
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </li>
  );
}
