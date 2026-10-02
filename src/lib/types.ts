import type { LateFeePolicy } from "@/lib/money";

export type Role = "instructor" | "student";
export type PaymentMethod = "stripe" | "bank_transfer" | "cash";
export type BookingStatus = "confirmed" | "cancelled" | "completed" | "no_show";
export type PaymentStatus = "unpaid" | "paid" | "refunded" | "waived";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled";

export type Profile = {
  id: string;
  role: Role;
  full_name: string;
  email: string;
  phone: string | null;
};

export type Instructor = {
  id: string;
  school_id: string;
  slug: string;
  bio: string | null;
  timezone: string;
  hourly_rate_pence: number;
  lesson_durations: number[];
  slot_interval_minutes: number;
  min_notice_hours: number;
  booking_window_days: number;
  accepts_stripe: boolean;
  accepts_bank_transfer: boolean;
  accepts_cash: boolean;
  bank_account_name: string | null;
  bank_sort_code: string | null;
  bank_account_number: string | null;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  cancellation_notice_hours: number;
  late_fee_policy: LateFeePolicy;
  late_fee_fixed_pence: number | null;
  late_fee_percent: number | null;
  terms_version: number;
  progress_tracking_enabled: boolean;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

export type Booking = {
  id: string;
  instructor_id: string;
  student_id: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  price_pence: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  pickup_location: string | null;
  student_notes: string | null;
  terms_version: number;
  cancelled_at: string | null;
  late_cancellation: boolean;
  late_fee_pence: number;
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  stripe: "Card (online)",
  bank_transfer: "Bank transfer",
  cash: "Cash on the day",
};

export const SKILL_LEVELS = ["Not started", "Introduced", "Under instruction", "Prompted", "Seldom prompted", "Independent"];

/** Payment methods an instructor currently offers, in display order. */
export function offeredPaymentMethods(i: Instructor, stripeConfigured: boolean): PaymentMethod[] {
  const methods: PaymentMethod[] = [];
  if (i.accepts_stripe && stripeConfigured && i.stripe_account_id && i.stripe_charges_enabled) methods.push("stripe");
  if (i.accepts_bank_transfer && i.bank_account_number && i.bank_sort_code) methods.push("bank_transfer");
  if (i.accepts_cash) methods.push("cash");
  return methods;
}

/** The amount a student currently owes on a booking. */
export function amountDue(b: Booking): number {
  if (b.payment_status !== "unpaid") return 0;
  if (b.status === "cancelled") return b.late_fee_pence;
  return b.price_pence;
}

/** Bank transfer reference students should use, short enough for UK banking apps. */
export function paymentReference(b: Pick<Booking, "id">): string {
  return `LESSON-${b.id.slice(0, 8).toUpperCase()}`;
}
