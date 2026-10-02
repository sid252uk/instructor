import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/app/auth/actions";
import { AuthCard } from "@/components/auth-card";
import { Button, Field, Flash, Input } from "@/components/ui";
import { getSession, homeFor } from "@/lib/auth";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const { user, profile } = await getSession();
  if (user) redirect(homeFor(profile));
  const next = typeof params.next === "string" ? params.next : "";

  return (
    <AuthCard title="Sign in">
      <Flash searchParams={params} />
      <form action={signIn} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password">
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <Button className="w-full">Sign in</Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Driving instructor?{" "}
        <Link href="/signup" className="font-medium text-blue-700 hover:underline">
          Start a free trial
        </Link>
        <br />
        Learner? Ask your instructor for their booking link.
      </p>
    </AuthCard>
  );
}
