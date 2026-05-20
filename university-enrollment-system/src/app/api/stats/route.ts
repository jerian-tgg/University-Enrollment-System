import { jsonFromPostgrestError, jsonOk } from "@/lib/api/json";
import { countEnrollmentsByStatus } from "@/lib/supabase/enrollment-schema";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const sb = createServerSupabase();

  const [students, courses, active, completed] = await Promise.all([
    sb.from("students").select("*", { count: "exact", head: true }),
    sb.from("courses").select("*", { count: "exact", head: true }),
    countEnrollmentsByStatus(sb, "enrolled"),
    countEnrollmentsByStatus(sb, "completed"),
  ]);

  if (students.error) return jsonFromPostgrestError(students.error);
  if (courses.error) return jsonFromPostgrestError(courses.error);
  if (active.error) return jsonFromPostgrestError(active.error);
  if (completed.error) return jsonFromPostgrestError(completed.error);

  return jsonOk({
    totalStudents: students.count ?? 0,
    totalCourses: courses.count ?? 0,
    activeEnrollments: active.count ?? 0,
    completed: completed.count ?? 0,
  });
}
