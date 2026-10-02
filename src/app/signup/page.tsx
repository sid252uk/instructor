import Link from "next/link";
import { signUpInstructor } from "@/app/auth/actions";
import { AuthCard } from "@/components/auth-card";
import { Button, Field, Flash, Input } from "@/components/ui";

export const metadata = { title: "Start your free trial" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const params = await searchParams;
  return (
    <AuthCard title="Start your 14-day free trial" subtitle="For driving instructors. No card needed to start.">
      <Flash searchParams={params} />
      <form action={signUpInstructor} className="space-y-4">
        <Field label="Full name">
          <Input name="full_name" autoComplete="name" required />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Mobile number" hint="Optional. Used for lesson notifications.">
          <Input name="phone" type="tel" autoComplete="tel" />
        </Field>
        <Field label="Password" hint="At least 8 characters.">
          <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Button className="w-full">Create instructor account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-blue-700 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
