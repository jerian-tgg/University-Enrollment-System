import { randomUUID } from "crypto";
import { jsonError, jsonFromPostgrestError, jsonOk } from "@/lib/api/json";
import { requireAuth } from "@/lib/auth/guards";
import { resolveStudentIdForMutation } from "@/lib/auth/permissions";
import { assertCanEnroll, ApiHttpError } from "@/lib/enrollment-service";
import { getEnrollmentSchemaMode, mapEnrollmentRow } from "@/lib/supabase/enrollment-schema";
import { createServerSupabase } from "@/lib/supabase/server";
import { isPostgrestError } from "@/lib/supabase/errors";
import { z } from "zod";

const bodySchema = z.object({
  studentId: z.string().min(1),
  courseId: z.string().min(1),
});

export async function POST(req: Request) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

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

  const studentId = resolveStudentIdForMutation(auth.session, parsed.data.studentId);
  if (!studentId) {
    return jsonError("Forbidden", 403);
  }
  const { courseId } = parsed.data;

  try {
    await assertCanEnroll(studentId, courseId);
  } catch (e: unknown) {
    if (e instanceof ApiHttpError) {
      return jsonError(e.message, e.status);
    }
    if (isPostgrestError(e)) {
      return jsonFromPostgrestError(e);
    }
    throw e;
  }

  const sb = createServerSupabase();
  const schemaMode = await getEnrollmentSchemaMode(sb);

  const { data: existing, error: exErr } = await sb
    .from("enrollments")
    .select("*")
    .eq("student_id", studentId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (exErr) return jsonFromPostgrestError(exErr);

  const existingRow = existing
    ? mapEnrollmentRow(existing as Record<string, unknown>, schemaMode)
    : null;

  if (existingRow && schemaMode === "full" && existingRow.status === "dropped") {
    const { data: updated, error: uErr } = await sb
      .from("enrollments")
      .update({ status: "enrolled", grade: null })
      .eq("id", existingRow.id)
      .select("*")
      .single();

    if (uErr) return jsonFromPostgrestError(uErr);
    const u = mapEnrollmentRow(updated as Record<string, unknown>, schemaMode);
    return jsonOk({
      id: u.id,
      studentId: u.student_id,
      courseId: u.course_id,
      status: u.status,
      grade: u.grade != null ? String(u.grade) : null,
      enrolledAt: u.enrolled_at,
    });
  }

  const insertPayload: Record<string, string> = {
    id: randomUUID(),
    student_id: studentId,
    course_id: courseId,
  };
  if (schemaMode === "full") {
    insertPayload.status = "enrolled";
  }

  const { data: created, error: cErr } = await sb
    .from("enrollments")
    .insert(insertPayload)
    .select("*")
    .single();

  if (cErr) {
    if (cErr.code === "23505") {
      return jsonError("Duplicate enrollment", 409);
    }
    return jsonFromPostgrestError(cErr);
  }

  const row = mapEnrollmentRow(created as Record<string, unknown>, schemaMode);
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
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

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

  const studentId = resolveStudentIdForMutation(auth.session, parsed.data.studentId);
  if (!studentId) {
    return jsonError("Forbidden", 403);
  }
  const { courseId } = parsed.data;
  const sb = createServerSupabase();
  const schemaMode = await getEnrollmentSchemaMode(sb);

  const { data: row, error: fErr } = await sb
    .from("enrollments")
    .select("*")
    .eq("student_id", studentId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (fErr) return jsonFromPostgrestError(fErr);
  if (!row) return jsonError("Enrollment not found", 404);

  const e = mapEnrollmentRow(row as Record<string, unknown>, schemaMode);
  if (schemaMode === "full" && e.status !== "enrolled") {
    return jsonError("Only active enrollments can be dropped", 409);
  }

  if (schemaMode === "legacy") {
    const { error: dErr } = await sb.from("enrollments").delete().eq("id", e.id);
    if (dErr) return jsonFromPostgrestError(dErr);
    return new Response(null, { status: 204 });
  }

  const { error: uErr } = await sb.from("enrollments").update({ status: "dropped" }).eq("id", e.id);
  if (uErr) return jsonFromPostgrestError(uErr);

  return new Response(null, { status: 204 });
}
