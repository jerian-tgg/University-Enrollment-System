import { jsonError, jsonFromPostgrestError, jsonOk } from "@/lib/api/json";
import { requireAuth, requireStudentAccess } from "@/lib/auth/guards";
import { formatGrade } from "@/lib/format";
import {
  enrollmentOrderColumn,
  getCourseSchemaMode,
  getEnrollmentSchemaMode,
  mapEnrollmentRow,
  toCourseRow,
} from "@/lib/supabase/enrollment-schema";
import { createServerSupabase } from "@/lib/supabase/server";
import type { CourseRow } from "@/lib/supabase/rows";
import { enrollmentStatusOrThrow } from "@/lib/supabase/rows";
import type { ApiStudentCourse } from "@/lib/types/api";

type Params = { params: Promise<{ id: string }> };

type RowWithCourse = Record<string, unknown> & { courses: CourseRow | CourseRow[] | null };

function oneCourse(c: CourseRow | CourseRow[] | null): CourseRow | null {
  if (!c) return null;
  return Array.isArray(c) ? (c[0] ?? null) : c;
}

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const denied = requireStudentAccess(auth.session, id);
  if (denied) return denied.response;

  const sb = createServerSupabase();

  const { data: student, error: sErr } = await sb.from("students").select("id").eq("id", id).maybeSingle();
  if (sErr) return jsonError(sErr.message, 500);
  if (!student) return jsonError("Student not found", 404);

  const [schemaMode, courseMode] = await Promise.all([
    getEnrollmentSchemaMode(sb),
    getCourseSchemaMode(sb),
  ]);
  const { data: rows, error } = await sb
    .from("enrollments")
    .select("*, courses(*)")
    .eq("student_id", id)
    .order(enrollmentOrderColumn(schemaMode), { ascending: false });

  if (error) return jsonFromPostgrestError(error);

  const list = (rows as RowWithCourse[] | null) ?? [];
  const out: ApiStudentCourse[] = [];

  for (const raw of list) {
    const e = mapEnrollmentRow(raw, schemaMode);
    const courseRaw = oneCourse(raw.courses as CourseRow | CourseRow[] | null);
    if (!courseRaw) return jsonError("Enrollment missing course join", 500);
    const course = toCourseRow(courseRaw as unknown as Record<string, unknown>, courseMode);
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
