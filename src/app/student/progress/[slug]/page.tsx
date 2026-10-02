import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { requireStudent } from "@/lib/auth";
import { SKILL_LEVELS } from "@/lib/types";

export const metadata = { title: "My progress" };

export default async function ProgressPage({ params }: PageProps<"/student/progress/[slug]">) {
  const { slug } = await params;
  const { supabase, user } = await requireStudent();

  const { data: instructor } = await supabase
    .from("instructors")
    .select("id, progress_tracking_enabled, profile:profiles!instructors_id_fkey(full_name)")
    .eq("slug", slug)
    .maybeSingle<{ id: string; progress_tracking_enabled: boolean; profile: { full_name: string } }>();
  if (!instructor?.progress_tracking_enabled) notFound();

  const [{ data: skills }, { data: progress }] = await Promise.all([
    supabase.from("skills").select("id, name").eq("instructor_id", instructor.id).order("position").returns<{ id: string; name: string }[]>(),
    supabase.from("skill_progress").select("skill_id, level").eq("student_id", user.id).returns<{ skill_id: string; level: number }[]>(),
  ]);
  const levels = new Map((progress ?? []).map((p) => [p.skill_id, p.level]));

  return (
    <>
      <PageHeader title="My progress" subtitle={`As recorded by ${instructor.profile.full_name}`} />
      <Card>
        <ul className="divide-y divide-slate-100">
          {(skills ?? []).map((s) => {
            const level = levels.get(s.id) ?? 0;
            return (
              <li key={s.id} className="py-3">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-900">{s.name}</span>
                  <span className="text-slate-600">{SKILL_LEVELS[level]}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={5} aria-valuenow={level}>
                  <div className="h-2 rounded-full bg-blue-600" style={{ width: `${(level / 5) * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
