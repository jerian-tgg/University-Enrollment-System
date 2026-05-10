import { jsonError, jsonOk } from "@/lib/api/json";
import { formatGrade } from "@/lib/format";
import { createServerSupabase } from "@/lib/supabase/server";
import type { CourseRow, EnrollmentRow, StudentRow } from "@/lib/supabase/rows";
import { enrollmentStatusOrThrow } from "@/lib/supabase/rows";
import type { ApiEnrollmentRow } from "@/lib/types/api";

type RowFull = EnrollmentRow & {
  students: StudentRow | StudentRow[] | null;
  courses: CourseRow | CourseRow[] | null;
};

function one<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function GET() {
  const sb = createServerSupabase();
  const { data: rows, error } = await sb
    .from("enrollments")
    .select("*, students!enrollments_student_id_fkey(*), courses!enrollments_course_id_fkey(*)")
    .order("enrolled_at", { ascending: false });

  if (error) return jsonError(error.message, 500);

  const list = (rows as RowFull[] | null) ?? [];
  const out: ApiEnrollmentRow[] = [];

  for (const e of list) {
    const st = one(e.students);
    const co = one(e.courses);
    if (!st || !co) return jsonError("Enrollment join incomplete", 500);
    out.push({
      id: e.id,
      studentId: st.id,
      studentCatalogId: st.student_id,
      studentName: `${st.first_name} ${st.last_name}`,
      studentEmail: st.email,
      courseId: co.id,
      courseCode: co.course_code,
      courseTitle: co.title,
      status: enrollmentStatusOrThrow(e.status),
      grade: formatGrade(e.grade),
      enrolledAt: e.enrolled_at,
    });
  }

  return jsonOk(out);
}
