import {
  countActiveEnrollmentsForCourse,
  getEnrollmentSchemaMode,
} from "@/lib/supabase/enrollment-schema";
import { createServerSupabase } from "@/lib/supabase/server";
import type { CourseRow } from "@/lib/supabase/rows";

export class ApiHttpError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiHttpError";
  }
}

export async function assertCanEnroll(studentId: string, courseId: string): Promise<void> {
  const sb = createServerSupabase();

  const { data: course, error: courseErr } = await sb
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .maybeSingle();

  if (courseErr) throw courseErr;
  if (!course) {
    throw new ApiHttpError("Course not found", 404);
  }

  const c = course as CourseRow;

  const { data: student, error: studentErr } = await sb
    .from("students")
    .select("id")
    .eq("id", studentId)
    .maybeSingle();

  if (studentErr) throw studentErr;
  if (!student) {
    throw new ApiHttpError("Student not found", 404);
  }

  const { count: activeCount, error: countErr } = await countActiveEnrollmentsForCourse(sb, courseId);

  if (countErr) throw countErr;
  if ((activeCount ?? 0) >= c.capacity) {
    throw new ApiHttpError("Course is at capacity", 409);
  }

  const schemaMode = await getEnrollmentSchemaMode(sb);

  if (c.prerequisite_id && schemaMode === "full") {
    const { data: prereqEnroll, error: prereqErr } = await sb
      .from("enrollments")
      .select("grade")
      .eq("student_id", studentId)
      .eq("course_id", c.prerequisite_id)
      .eq("status", "completed")
      .maybeSingle();

    if (prereqErr) throw prereqErr;
    const g = prereqEnroll?.grade != null ? Number(prereqEnroll.grade) : NaN;
    if (!prereqEnroll || Number.isNaN(g) || g < 75) {
      throw new ApiHttpError(
        "Student must complete the prerequisite course with grade ≥ 75 before enrolling",
        409
      );
    }
  }

  const { data: existing, error: existingErr } = await sb
    .from("enrollments")
    .select(schemaMode === "full" ? "status" : "id")
    .eq("student_id", studentId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existingErr) throw existingErr;

  if (schemaMode === "legacy") {
    if (existing) {
      throw new ApiHttpError("Student is already enrolled in this course", 409);
    }
    return;
  }

  const status = (existing as { status?: string } | null)?.status;
  if (status === "enrolled") {
    throw new ApiHttpError("Student is already enrolled in this course", 409);
  }

  if (status === "completed") {
    throw new ApiHttpError("Enrollment already completed for this course", 409);
  }
}
