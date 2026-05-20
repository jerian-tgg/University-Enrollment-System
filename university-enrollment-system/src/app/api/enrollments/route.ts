import { jsonError, jsonFromPostgrestError, jsonOk } from "@/lib/api/json";
import { formatGrade } from "@/lib/format";
import {
  enrollmentOrderColumn,
  getCourseSchemaMode,
  getEnrollmentSchemaMode,
  getStudentSchemaMode,
  mapEnrollmentRow,
  toCourseRow,
  toStudentRow,
} from "@/lib/supabase/enrollment-schema";
import { createServerSupabase } from "@/lib/supabase/server";
import { enrollmentStatusOrThrow } from "@/lib/supabase/rows";
import type { ApiEnrollmentRow } from "@/lib/types/api";

type RowFull = Record<string, unknown> & {
  students: Record<string, unknown> | Record<string, unknown>[] | null;
  courses: Record<string, unknown> | Record<string, unknown>[] | null;
};

function one<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function GET() {
  const sb = createServerSupabase();
  const [schemaMode, studentMode, courseMode] = await Promise.all([
    getEnrollmentSchemaMode(sb),
    getStudentSchemaMode(sb),
    getCourseSchemaMode(sb),
  ]);
  const { data: rows, error } = await sb
    .from("enrollments")
    .select("*, students(*), courses(*)")
    .order(enrollmentOrderColumn(schemaMode), { ascending: false });

  if (error) return jsonFromPostgrestError(error);

  const list = (rows as RowFull[] | null) ?? [];
  const out: ApiEnrollmentRow[] = [];

  for (const raw of list) {
    const e = mapEnrollmentRow(raw as unknown as Record<string, unknown>, schemaMode);
    const stRaw = one(raw.students);
    const coRaw = one(raw.courses);
    if (!stRaw || !coRaw) return jsonError("Enrollment join incomplete", 500);
    const st = toStudentRow(stRaw, studentMode);
    const co = toCourseRow(coRaw, courseMode);
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
