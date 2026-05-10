import { jsonError, jsonOk } from "@/lib/api/json";
import { formatGrade } from "@/lib/format";
import { createServerSupabase } from "@/lib/supabase/server";
import type { EnrollmentRow, StudentRow } from "@/lib/supabase/rows";
import { enrollmentStatusOrThrow } from "@/lib/supabase/rows";
import type { ApiCourseStudent } from "@/lib/types/api";

type Params = { params: Promise<{ id: string }> };

type RowWithStudent = EnrollmentRow & { students: StudentRow | StudentRow[] | null };

function oneStudent(s: StudentRow | StudentRow[] | null): StudentRow | null {
  if (!s) return null;
  return Array.isArray(s) ? (s[0] ?? null) : s;
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const sb = createServerSupabase();

  const { data: course, error: cErr } = await sb.from("courses").select("id").eq("id", id).maybeSingle();
  if (cErr) return jsonError(cErr.message, 500);
  if (!course) return jsonError("Course not found", 404);

  const { data: rows, error } = await sb
    .from("enrollments")
    .select("*, students!enrollments_student_id_fkey(*)")
    .eq("course_id", id)
    .order("enrolled_at", { ascending: false });

  if (error) return jsonError(error.message, 500);

  const list = (rows as RowWithStudent[] | null) ?? [];
  const out: ApiCourseStudent[] = [];

  for (const e of list) {
    const st = oneStudent(e.students);
    if (!st) return jsonError("Enrollment missing student join", 500);
    out.push({
      enrollmentId: e.id,
      studentId: st.id,
      studentCatalogId: st.student_id,
      firstName: st.first_name,
      lastName: st.last_name,
      email: st.email,
      status: enrollmentStatusOrThrow(e.status),
      grade: formatGrade(e.grade),
    });
  }

  return jsonOk(out);
}
