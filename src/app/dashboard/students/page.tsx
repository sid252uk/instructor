import Link from "next/link";
import { CopyLink } from "@/components/copy-link";
import { Button, Card, EmptyState, Field, Flash, Input, PageHeader, SectionTitle } from "@/components/ui";
import { requireInstructor } from "@/lib/auth";
import { appUrl } from "@/lib/env";
import { inviteStudent } from "./actions";

export const metadata = { title: "Students" };

type Row = { joined_at: string; student: { id: string; full_name: string; email: string; phone: string | null } };

export default async function StudentsPage({ searchParams }: PageProps<"/dashboard/students">) {
  const params = await searchParams;
  const { supabase, instructor } = await requireInstructor();
  const { data: students } = await supabase
    .from("instructor_students")
    .select("joined_at, student:profiles!instructor_students_student_id_fkey(id, full_name, email, phone)")
    .eq("instructor_id", instructor.id)
    .order("joined_at", { ascending: false })
    .returns<Row[]>();

  return (
    <>
      <PageHeader title="Students" subtitle="Learners who joined through your booking link." />
      <Flash searchParams={params} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {students?.length ? (
            <ul className="divide-y divide-slate-100">
              {students.map(({ student }) => (
                <li key={student.id} className="py-3">
                  <Link href={`/dashboard/students/${student.id}`} className="font-medium text-slate-900 hover:underline">
                    {student.full_name}
                  </Link>
                  <p className="text-sm text-slate-600">
                    <a href={`mailto:${student.email}`} className="hover:underline">{student.email}</a>
                    {student.phone && (
                      <>
                        {" · "}
                        <a href={`tel:${student.phone}`} className="hover:underline">{student.phone}</a>
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No students yet. Share your booking link to get started.</EmptyState>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <SectionTitle>Booking link</SectionTitle>
            <CopyLink url={`${appUrl}/join/${instructor.slug}`} />
          </Card>
          <Card>
            <SectionTitle>Invite by email</SectionTitle>
            <form action={inviteStudent} className="space-y-3">
              <Field label="Name">
                <Input name="name" />
              </Field>
              <Field label="Email">
                <Input name="email" type="email" required />
              </Field>
              <Button>Send invite</Button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
