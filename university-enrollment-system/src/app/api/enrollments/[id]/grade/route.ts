import { jsonError, jsonFromPostgrestError, jsonOk } from "@/lib/api/json";
import { requireAdmin } from "@/lib/auth/guards";
import { formatGrade } from "@/lib/format";
import {
  getCourseSchemaMode,
  getEnrollmentSchemaMode,
  getStudentSchemaMode,
  mapEnrollmentRow,
  MIGRATION_HINT,
  toCourseRow,
  toStudentRow,
} from "@/lib/supabase/enrollment-schema";
import { createServerSupabase } from "@/lib/supabase/server";
import type { CourseRow, EnrollmentRow, StudentRow } from "@/lib/supabase/rows";
import { enrollmentStatusOrThrow } from "@/lib/supabase/rows";
import { z } from "zod";

const bodySchema = z.object({
  grade: z.coerce.number().finite(),
});

type Params = { params: Promise<{ id: string }> };

type RowFull = EnrollmentRow & {
  students: StudentRow | StudentRow[] | null;
  courses: CourseRow | CourseRow[] | null;
};

function one<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => i.message).join(", "), 400);
  }

  const sb = createServerSupabase();
  const schemaMode = await getEnrollmentSchemaMode(sb);
  if (schemaMode === "legacy") {
    return jsonError(MIGRATION_HINT, 503);
  }

  const { data: enrollment, error: fErr } = await sb.from("enrollments").select("*").eq("id", id).maybeSingle();
  if (fErr) return jsonFromPostgrestError(fErr);
  if (!enrollment) return jsonError("Enrollment not found", 404);

  const e = enrollment as EnrollmentRow;
  if (e.status === "dropped") {
    return jsonError("Cannot set grade for a dropped enrollment", 409);
  }

  const g = parsed.data.grade;
  let nextStatus = e.status;
  if (g >= 75) {
    nextStatus = "completed";
  } else if (e.status === "completed") {
    nextStatus = "enrolled";
  }

  const { data: updated, error: uErr } = await sb
    .from("enrollments")
    .update({ grade: g.toFixed(2), status: nextStatus })
    .eq("id", id)
    .select("*, students(*), courses(*)")
    .single();

  if (uErr) return jsonFromPostgrestError(uErr);

  const row = updated as RowFull;
  const stRaw = one(row.students);
  const coRaw = one(row.courses);
  if (!stRaw || !coRaw) return jsonError("Enrollment join incomplete", 500);

  const [studentMode, courseMode] = await Promise.all([
    getStudentSchemaMode(sb),
    getCourseSchemaMode(sb),
  ]);
  const st = toStudentRow(stRaw as Record<string, unknown>, studentMode);
  const co = toCourseRow(coRaw as Record<string, unknown>, courseMode);
  const mapped = mapEnrollmentRow(row as unknown as Record<string, unknown>, "full");

  return jsonOk({
    id: mapped.id,
    studentId: st.id,
    studentCatalogId: st.student_id,
    studentName: `${st.first_name} ${st.last_name}`,
    studentEmail: st.email,
    courseId: co.id,
    courseCode: co.course_code,
    courseTitle: co.title,
    status: enrollmentStatusOrThrow(mapped.status),
    grade: formatGrade(mapped.grade),
    enrolledAt: mapped.enrolled_at,
  });
}
