import { jsonError, jsonFromPostgrestError, jsonOk } from "@/lib/api/json";
import { requireAdmin } from "@/lib/auth/guards";
import { formatGradeDisplay, isFailedGrade, isIncompleteGrade, isPassingGrade, parseGradeInput } from "@/lib/grades";
import { studentNameFromRow } from "@/lib/format";
import {
  enrollmentSelectWithJoins,
  getCourseSchemaMode,
  getEnrollmentSchemaMode,
  getStudentSchemaMode,
  mapEnrollmentRow,
  toCourseRow,
  toStudentRow,
} from "@/lib/supabase/enrollment-schema";
import { createServerSupabase } from "@/lib/supabase/server";
import type { CourseRow, EnrollmentRow, StudentRow } from "@/lib/supabase/rows";
import { enrollmentStatusOrThrow } from "@/lib/supabase/rows";
import { z } from "zod";

const bodySchema = z.object({
  grade: z.string().min(1),
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

  const gradeResult = parseGradeInput(parsed.data.grade);
  if (!gradeResult.ok) {
    return jsonError(gradeResult.error, 400);
  }

  const sb = createServerSupabase();
  const [schemaMode, studentMode, courseMode] = await Promise.all([
    getEnrollmentSchemaMode(sb),
    getStudentSchemaMode(sb),
    getCourseSchemaMode(sb),
  ]);

  const { data: enrollment, error: fErr } = await sb.from("enrollments").select("*").eq("id", id).maybeSingle();
  if (fErr) return jsonFromPostgrestError(fErr);
  if (!enrollment) return jsonError("Enrollment not found", 404);

  const e = mapEnrollmentRow(enrollment as Record<string, unknown>, schemaMode);
  if (schemaMode === "full" && e.status === "dropped") {
    return jsonError("Cannot set grade for a dropped enrollment", 409);
  }

  const stored = gradeResult.stored;
  const patch: Record<string, unknown> = { grade: stored };

  if (schemaMode === "full") {
    if (isIncompleteGrade(stored)) {
      patch.status = "enrolled";
    } else if (isPassingGrade(stored) || isFailedGrade(stored)) {
      patch.status = "completed";
    }
  }

  const { data: updated, error: uErr } = await sb
    .from("enrollments")
    .update(patch)
    .eq("id", id)
    .select(enrollmentSelectWithJoins)
    .single();

  if (uErr) return jsonFromPostgrestError(uErr);

  const row = updated as RowFull;
  const stRaw = one(row.students);
  const coRaw = one(row.courses);
  if (!stRaw || !coRaw) return jsonError("Enrollment join incomplete", 500);

  const st = toStudentRow(stRaw as Record<string, unknown>, studentMode);
  const co = toCourseRow(coRaw as Record<string, unknown>, courseMode);
  const mapped = mapEnrollmentRow(row as unknown as Record<string, unknown>, schemaMode);

  return jsonOk({
    id: mapped.id,
    studentId: st.id,
    studentCatalogId: st.student_id,
    studentName: studentNameFromRow(st),
    studentEmail: st.email,
    courseId: co.id,
    courseCode: co.course_code,
    courseTitle: co.title,
    status: enrollmentStatusOrThrow(mapped.status),
    grade: formatGradeDisplay(mapped.grade),
    enrolledAt: mapped.enrolled_at,
  });
}
