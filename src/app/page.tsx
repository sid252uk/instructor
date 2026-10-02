import Link from "next/link";
import { ButtonLink } from "@/components/ui";
import { getSession, homeFor } from "@/lib/auth";

const features = [
  ["Instant booking", "Learners book straight into the availability you set, with double bookings blocked automatically."],
  ["Get paid your way", "Take card payments online, share your bank details, or accept cash. Turn on whichever suit you."],
  ["Your cancellation rules", "Set your notice period and late fee, and write your own terms that learners accept when they book."],
  ["Reminders sent for you", "Booking confirmations and lesson reminders go out by email and text."],
  ["Track progress", "Optional skills checklist so you and your learners can see how they are getting on."],
  ["Works on your phone", "Built for checking your diary between lessons."],
];

export default async function Home() {
  const { user, profile } = await getSession();

  return (
    <main className="flex-1">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <span className="font-semibold text-blue-800">Instructor</span>
        {user ? (
          <ButtonLink href={homeFor(profile)} variant="secondary">
            Open app
          </ButtonLink>
        ) : (
          <Link href="/login" className="text-sm font-medium text-slate-700 hover:underline">
            Sign in
          </Link>
        )}
      </header>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:py-20">
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Run your driving school from your phone.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-slate-600">
          Availability, bookings, payments and reminders for UK driving instructors. Your learners book and pay
          through your own link.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/signup">Start 14-day free trial</ButtonLink>
          <ButtonLink href="/login" variant="secondary">
            Sign in
          </ButtonLink>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-16 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(([title, body]) => (
          <div key={title} className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-600">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
