import { AppShell } from "@/components/app-shell";
import { requireStudent } from "@/lib/auth";

const nav = [{ href: "/student", label: "My lessons" }];

export default async function StudentLayout({ children }: LayoutProps<"/student">) {
  const { profile } = await requireStudent();
  return (
    <AppShell nav={nav} name={profile.full_name}>
      {children}
    </AppShell>
  );
}
