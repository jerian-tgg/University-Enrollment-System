import { jsonOk } from "@/lib/api/json";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const sb = createServerSupabase();

  const [students, courses, active, completed] = await Promise.all([
    sb.from("students").select("*", { count: "exact", head: true }),
    sb.from("courses").select("*", { count: "exact", head: true }),
    sb
      .from("enrollments")
      .select("*", { count: "exact", head: true })
      .eq("status", "enrolled"),
    sb
      .from("enrollments")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed"),
  ]);

  if (students.error) return Response.json({ error: students.error.message }, { status: 500 });
  if (courses.error) return Response.json({ error: courses.error.message }, { status: 500 });
  if (active.error) return Response.json({ error: active.error.message }, { status: 500 });
  if (completed.error) return Response.json({ error: completed.error.message }, { status: 500 });

  return jsonOk({
    totalStudents: students.count ?? 0,
    totalCourses: courses.count ?? 0,
    activeEnrollments: active.count ?? 0,
    completed: completed.count ?? 0,
  });
}
