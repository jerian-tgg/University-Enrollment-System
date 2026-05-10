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

  const { count: activeCount, error: countErr } = await sb
    .from("enrollments")
    .select("*", { count: "exact", head: true })
    .eq("course_id", courseId)
    .eq("status", "enrolled");

  if (countErr) throw countErr;
  if ((activeCount ?? 0) >= c.capacity) {
    throw new ApiHttpError("Course is at capacity", 409);
  }

  if (c.prerequisite_id) {
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
    .select("status")
    .eq("student_id", studentId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existingErr) throw existingErr;

  if (existing?.status === "enrolled") {
    throw new ApiHttpError("Student is already enrolled in this course", 409);
  }

  if (existing?.status === "completed") {
    throw new ApiHttpError("Enrollment already completed for this course", 409);
  }
}
