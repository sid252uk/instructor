import { Badge, Button, Card, Flash, PageHeader } from "@/components/ui";
import { requireInstructor } from "@/lib/auth";
import { features } from "@/lib/env";
import { formatDate, localParts } from "@/lib/time";
import { openBillingPortal, startSubscription } from "./actions";

export const metadata = { title: "Billing" };

const STATUS = {
  trialing: { label: "Free trial", tone: "blue" },
  active: { label: "Active", tone: "green" },
  past_due: { label: "Payment overdue", tone: "amber" },
  cancelled: { label: "Cancelled", tone: "red" },
} as const;

export default async function BillingPage({ searchParams }: PageProps<"/dashboard/billing">) {
  const params = await searchParams;
  const { instructor } = await requireInstructor();
  const status = STATUS[instructor.subscription_status];
  const trialEnd = formatDate(localParts(new Date(instructor.trial_ends_at), instructor.timezone).date, instructor.timezone);
  const hasSubscription = Boolean(instructor.stripe_subscription_id);

  return (
    <>
      <PageHeader title="Billing" subtitle="Your monthly subscription to Instructor." />
      <Flash searchParams={params} />
      <Card className="max-w-xl space-y-4">
        <p className="flex items-center gap-2 text-sm">
          Status: <Badge tone={status.tone}>{status.label}</Badge>
        </p>
        {instructor.subscription_status === "trialing" && <p className="text-sm text-slate-700">Your free trial ends on {trialEnd}.</p>}

        {!features.subscriptions ? (
          <p className="text-sm text-slate-600">Online subscriptions are not switched on for this site yet, so there is nothing to pay.</p>
        ) : hasSubscription ? (
          <form action={openBillingPortal}>
            <Button variant="secondary">Manage subscription</Button>
          </form>
        ) : (
          <form action={startSubscription}>
            <Button>Subscribe</Button>
          </form>
        )}
      </Card>
    </>
  );
}
