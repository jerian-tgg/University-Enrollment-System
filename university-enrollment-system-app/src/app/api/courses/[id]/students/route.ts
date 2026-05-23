import { jsonError, jsonFromPostgrestError, jsonOk } from "@/lib/api/json";
import { requireAdmin } from "@/lib/auth/guards";
import { formatGrade } from "@/lib/format";
import {
  enrollmentOrderColumn,
  enrollmentSelectWithStudent,
  getEnrollmentSchemaMode,
  getStudentSchemaMode,
  mapEnrollmentRow,
  toStudentRow,
} from "@/lib/supabase/enrollment-schema";
import { createServerSupabase } from "@/lib/supabase/server";
import type { StudentRow } from "@/lib/supabase/rows";
import { enrollmentStatusOrThrow } from "@/lib/supabase/rows";
import type { ApiCourseStudent } from "@/lib/types/api";

type Params = { params: Promise<{ id: string }> };

type RowWithStudent = Record<string, unknown> & { students: StudentRow | StudentRow[] | null };

function oneStudent(s: StudentRow | StudentRow[] | null): StudentRow | null {
  if (!s) return null;
  return Array.isArray(s) ? (s[0] ?? null) : s;
}

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const sb = createServerSupabase();

  const { data: course, error: cErr } = await sb.from("courses").select("id").eq("id", id).maybeSingle();
  if (cErr) return jsonError(cErr.message, 500);
  if (!course) return jsonError("Course not found", 404);

  const [schemaMode, studentMode] = await Promise.all([
    getEnrollmentSchemaMode(sb),
    getStudentSchemaMode(sb),
  ]);
  const { data: rows, error } = await sb
    .from("enrollments")
    .select(enrollmentSelectWithStudent)
    .eq("course_id", id)
    .order(enrollmentOrderColumn(schemaMode), { ascending: false });

  if (error) return jsonFromPostgrestError(error);

  const list = (rows as RowWithStudent[] | null) ?? [];
  const out: ApiCourseStudent[] = [];

  for (const raw of list) {
    const e = mapEnrollmentRow(raw, schemaMode);
    const stRaw = oneStudent(raw.students);
    if (!stRaw) return jsonError("Enrollment missing student join", 500);
    const st = toStudentRow(stRaw as Record<string, unknown>, studentMode);
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
