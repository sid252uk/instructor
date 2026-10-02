import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireInstructor } from "@/lib/auth";

const nav = [
  { href: "/dashboard", label: "Today" },
  { href: "/dashboard/bookings", label: "Bookings" },
  { href: "/dashboard/availability", label: "Availability" },
  { href: "/dashboard/students", label: "Students" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/dashboard/billing", label: "Billing" },
];

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const { profile, instructor } = await requireInstructor();
  const trialEnds = new Date(instructor.trial_ends_at);
  const daysLeft = Math.ceil((trialEnds.getTime() - Date.now()) / 86400_000);

  let banner: React.ReactNode = null;
  if (instructor.subscription_status === "trialing") {
    banner =
      daysLeft > 0
        ? `Free trial: ${daysLeft} day${daysLeft === 1 ? "" : "s"} left.`
        : "Your free trial has ended. Subscribe to keep taking bookings.";
  } else if (instructor.subscription_status !== "active") {
    banner = "There is a problem with your subscription.";
  }

  return (
    <AppShell nav={nav} name={profile.full_name}>
      {banner && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>{banner}</span>
          <Link href="/dashboard/billing" className="font-medium underline">
            Manage billing
          </Link>
        </div>
      )}
      {children}
    </AppShell>
  );
}
