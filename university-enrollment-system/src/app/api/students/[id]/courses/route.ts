import { jsonError, jsonOk } from "@/lib/api/json";
import { formatGrade } from "@/lib/format";
import { createServerSupabase } from "@/lib/supabase/server";
import type { CourseRow, EnrollmentRow } from "@/lib/supabase/rows";
import { enrollmentStatusOrThrow } from "@/lib/supabase/rows";
import type { ApiStudentCourse } from "@/lib/types/api";

type Params = { params: Promise<{ id: string }> };

type RowWithCourse = EnrollmentRow & { courses: CourseRow | CourseRow[] | null };

function oneCourse(c: CourseRow | CourseRow[] | null): CourseRow | null {
  if (!c) return null;
  return Array.isArray(c) ? (c[0] ?? null) : c;
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const sb = createServerSupabase();

  const { data: student, error: sErr } = await sb.from("students").select("id").eq("id", id).maybeSingle();
  if (sErr) return jsonError(sErr.message, 500);
  if (!student) return jsonError("Student not found", 404);

  const { data: rows, error } = await sb
    .from("enrollments")
    .select("*, courses!enrollments_course_id_fkey(*)")
    .eq("student_id", id)
    .order("enrolled_at", { ascending: false });

  if (error) return jsonError(error.message, 500);

  const list = (rows as RowWithCourse[] | null) ?? [];
  const out: ApiStudentCourse[] = [];

  for (const e of list) {
    const course = oneCourse(e.courses);
    if (!course) return jsonError("Enrollment missing course join", 500);
    out.push({
      courseId: e.course_id,
      courseCode: course.course_code,
      title: course.title,
      units: course.units,
      status: enrollmentStatusOrThrow(e.status),
      grade: formatGrade(e.grade),
      enrolledAt: e.enrolled_at,
    });
  }

  return jsonOk(out);
}
