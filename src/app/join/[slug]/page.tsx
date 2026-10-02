import Link from "next/link";
import { notFound } from "next/navigation";
import { joinInstructor, signUpStudent } from "@/app/auth/actions";
import { AuthCard } from "@/components/auth-card";
import { Button, ButtonLink, Field, Flash, Input } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { formatGBP } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Book lessons" };

// An instructor's booking link. New learners sign up here; existing learners
// are linked with one click.
export default async function JoinPage({ params, searchParams }: PageProps<"/join/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;

  const admin = createAdminClient();
  const { data: instructor } = await admin
    .from("instructors")
    .select("id, slug, bio, hourly_rate_pence, profiles!instructors_id_fkey(full_name)")
    .eq("slug", slug)
    .maybeSingle<{ id: string; slug: string; bio: string | null; hourly_rate_pence: number; profiles: { full_name: string } }>();
  if (!instructor) notFound();

  const name = instructor.profiles.full_name;
  const { user, profile } = await getSession();

  const intro = (
    <>
      Book driving lessons with {name}. {formatGBP(instructor.hourly_rate_pence)} per hour.
      {instructor.bio && <span className="mt-2 block">{instructor.bio}</span>}
    </>
  );

  if (user && profile) {
    return (
      <AuthCard title={`Lessons with ${name}`} subtitle={intro}>
        <Flash searchParams={query} />
        {profile.role === "student" ? (
          <form action={joinInstructor.bind(null, slug)}>
            <Button className="w-full">Continue to booking</Button>
          </form>
        ) : (
          <div className="space-y-3 text-sm text-slate-700">
            <p>You are signed in as an instructor. Learners use this link to sign up and book with you.</p>
            <ButtonLink href="/dashboard" variant="secondary" className="w-full">
              Back to dashboard
            </ButtonLink>
          </div>
        )}
      </AuthCard>
    );
  }

  return (
    <AuthCard title={`Lessons with ${name}`} subtitle={intro}>
      <Flash searchParams={query} />
      <form action={signUpStudent.bind(null, slug)} className="space-y-4">
        <Field label="Full name">
          <Input name="full_name" autoComplete="name" required />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Mobile number" hint="For lesson reminders by text.">
          <Input name="phone" type="tel" autoComplete="tel" />
        </Field>
        <Field label="Password" hint="At least 8 characters.">
          <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Button className="w-full">Create account and book</Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href={`/login?next=/join/${slug}`} className="font-medium text-blue-700 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
