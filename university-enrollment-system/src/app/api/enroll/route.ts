import { randomUUID } from "crypto";
import { jsonError, jsonOk } from "@/lib/api/json";
import { assertCanEnroll, ApiHttpError } from "@/lib/enrollment-service";
import { createServerSupabase } from "@/lib/supabase/server";
import type { EnrollmentRow } from "@/lib/supabase/rows";
import { z } from "zod";

const bodySchema = z.object({
  studentId: z.string().min(1),
  courseId: z.string().min(1),
});

export async function POST(req: Request) {
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

  const { studentId, courseId } = parsed.data;

  try {
    await assertCanEnroll(studentId, courseId);
  } catch (e: unknown) {
    if (e instanceof ApiHttpError) {
      return jsonError(e.message, e.status);
    }
    throw e;
  }

  const sb = createServerSupabase();

  const { data: existing, error: exErr } = await sb
    .from("enrollments")
    .select("*")
    .eq("student_id", studentId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (exErr) return jsonError(exErr.message, 500);

  if (existing && (existing as EnrollmentRow).status === "dropped") {
    const { data: updated, error: uErr } = await sb
      .from("enrollments")
      .update({ status: "enrolled", grade: null })
      .eq("id", (existing as EnrollmentRow).id)
      .select("*")
      .single();

    if (uErr) return jsonError(uErr.message, 500);
    const u = updated as EnrollmentRow;
    return jsonOk({
      id: u.id,
      studentId: u.student_id,
      courseId: u.course_id,
      status: u.status,
      grade: u.grade != null ? String(u.grade) : null,
      enrolledAt: u.enrolled_at,
    });
  }

  const { data: created, error: cErr } = await sb
    .from("enrollments")
    .insert({
      id: randomUUID(),
      student_id: studentId,
      course_id: courseId,
      status: "enrolled",
    })
    .select("*")
    .single();

  if (cErr) {
    if (cErr.code === "23505") {
      return jsonError("Duplicate enrollment", 409);
    }
    return jsonError(cErr.message, 500);
  }

  const row = created as EnrollmentRow;
  return jsonOk({
    id: row.id,
    studentId: row.student_id,
    courseId: row.course_id,
    status: row.status,
    grade: row.grade != null ? String(row.grade) : null,
    enrolledAt: row.enrolled_at,
  });
}

export async function DELETE(req: Request) {
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

  const { studentId, courseId } = parsed.data;
  const sb = createServerSupabase();

  const { data: row, error: fErr } = await sb
    .from("enrollments")
    .select("*")
    .eq("student_id", studentId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (fErr) return jsonError(fErr.message, 500);
  if (!row) return jsonError("Enrollment not found", 404);

  const e = row as EnrollmentRow;
  if (e.status !== "enrolled") {
    return jsonError("Only active enrollments can be dropped", 409);
  }

  const { error: uErr } = await sb.from("enrollments").update({ status: "dropped" }).eq("id", e.id);
  if (uErr) return jsonError(uErr.message, 500);

  return new Response(null, { status: 204 });
}
