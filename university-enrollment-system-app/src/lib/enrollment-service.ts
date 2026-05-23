import {
  assertStudentMeetsCoursePrerequisites,
  PrerequisiteNotMetError,
} from "@/lib/prerequisites";
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

  if (schemaMode === "full") {
    try {
      await assertStudentMeetsCoursePrerequisites(sb, studentId, courseId);
    } catch (e: unknown) {
      if (e instanceof PrerequisiteNotMetError) {
        const { data: prereqCourse } = await sb
          .from("courses")
          .select("course_code")
          .eq("id", e.prerequisiteCourseId)
          .maybeSingle();
        const code =
          (prereqCourse as { course_code?: string } | null)?.course_code ?? "prerequisite";
        throw new ApiHttpError(
          `Complete ${code} with a passing grade (3.0 or better), including its prerequisites, before enrolling`,
          409
        );
      }
      throw e;
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
