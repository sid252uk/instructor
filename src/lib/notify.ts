import "server-only";
import { appUrl, features } from "@/lib/env";
import { formatGBP } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { amountDue, PAYMENT_METHOD_LABELS, type Booking, type Profile } from "@/lib/types";

// Email goes through Resend and SMS through Twilio, both via plain HTTPS so
// no SDKs are needed. Without keys the message is logged instead of sent.

export async function sendEmail(to: string, subject: string, text: string) {
  if (!features.email) {
    console.info(`[email stub] to=${to} subject="${subject}"\n${text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
  });
  if (!res.ok) console.error(`Email to ${to} failed: ${res.status} ${await res.text()}`);
}

/** Normalises UK numbers like 07700 900123 to +447700900123. */
export function toE164(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  if (/^\+44\d{10}$/.test(digits)) return digits;
  if (/^0\d{10}$/.test(digits)) return `+44${digits.slice(1)}`;
  if (/^44\d{10}$/.test(digits)) return `+${digits}`;
  return null;
}

export async function sendSms(to: string | null, body: string) {
  const number = to ? toE164(to) : null;
  if (!number) return;
  if (!features.sms) {
    console.info(`[sms stub] to=${number}\n${body}`);
    return;
  }
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: number, From: process.env.TWILIO_FROM_NUMBER!, Body: body }),
  });
  if (!res.ok) console.error(`SMS to ${number} failed: ${res.status} ${await res.text()}`);
}

type Parties = { booking: Booking; student: Profile; instructor: Profile; tz: string };

export async function notifyBookingConfirmed({ booking, student, instructor, tz }: Parties) {
  const when = formatDateTime(booking.starts_at, tz);
  const link = `${appUrl}/student/bookings/${booking.id}`;
  await Promise.all([
    sendEmail(
      student.email,
      `Lesson booked: ${when}`,
      `Hi ${student.full_name},\n\nYour driving lesson with ${instructor.full_name} is confirmed for ${when}.\n` +
        `Price: ${formatGBP(booking.price_pence)} (${PAYMENT_METHOD_LABELS[booking.payment_method]}).\n\n` +
        `View or cancel: ${link}`,
    ),
    sendEmail(
      instructor.email,
      `New booking: ${student.full_name}, ${when}`,
      `${student.full_name} booked a lesson for ${when}.\n\n${appUrl}/dashboard/bookings`,
    ),
    sendSms(student.phone, `Lesson with ${instructor.full_name} confirmed for ${when}. ${link}`),
  ]);
}

export async function notifyBookingCancelled({ booking, student, instructor, tz }: Parties, byInstructor: boolean) {
  const when = formatDateTime(booking.starts_at, tz);
  const fee = amountDue(booking);
  const feeLine = fee > 0 ? `\nA late cancellation fee of ${formatGBP(fee)} applies.` : "";
  const studentText = byInstructor
    ? `${instructor.full_name} has cancelled your lesson on ${when}.`
    : `Your lesson on ${when} has been cancelled.${feeLine}`;
  await Promise.all([
    sendEmail(student.email, `Lesson cancelled: ${when}`, `Hi ${student.full_name},\n\n${studentText}`),
    sendEmail(instructor.email, `Lesson cancelled: ${student.full_name}, ${when}`, `The lesson with ${student.full_name} on ${when} was cancelled.${feeLine}`),
    sendSms(student.phone, studentText),
  ]);
}

export async function notifyLessonReminder({ booking, student, instructor, tz }: Parties) {
  const when = formatDateTime(booking.starts_at, tz);
  const text = `Reminder: driving lesson with ${instructor.full_name} on ${when}.`;
  await Promise.all([
    sendEmail(student.email, `Reminder: lesson ${when}`, `Hi ${student.full_name},\n\n${text}\n\n${appUrl}/student/bookings/${booking.id}`),
    sendSms(student.phone, text),
  ]);
}
