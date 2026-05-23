import { jsonError, jsonFromPostgrestError, jsonOk } from "@/lib/api/json";
import { requireAdmin, requireAuth } from "@/lib/auth/guards";
import {
  countActiveEnrollmentsForCourse,
  courseCodeColumn,
  getCourseSchemaMode,
  toCourseRow,
} from "@/lib/supabase/enrollment-schema";
import { createServerSupabase } from "@/lib/supabase/server";
import { isUniqueViolation } from "@/lib/supabase/errors";
import { mapCourseListItem } from "@/lib/supabase/mappers";
import { z } from "zod";

const updateSchema = z.object({
  courseCode: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  capacity: z.coerce.number().int().positive().optional(),
  units: z.coerce.number().int().positive().optional(),
  prerequisiteId: z.string().optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const sb = createServerSupabase();

  const schemaMode = await getCourseSchemaMode(sb);
  const { data: course, error: cErr } = await sb.from("courses").select("*").eq("id", id).maybeSingle();
  if (cErr) return jsonFromPostgrestError(cErr);
  if (!course) return jsonError("Course not found", 404);

  const row = toCourseRow(course as Record<string, unknown>, schemaMode);

  const { count: enrolledCount, error: cntErr } = await countActiveEnrollmentsForCourse(sb, id);
  if (cntErr) return jsonFromPostgrestError(cntErr);

  let prereqCode: string | null = null;
  if (row.prerequisite_id && schemaMode === "full") {
    const { data: p, error: pErr } = await sb
      .from("courses")
      .select("course_code")
      .eq("id", row.prerequisite_id)
      .maybeSingle();
    if (pErr) return jsonFromPostgrestError(pErr);
    prereqCode = p?.course_code ?? null;
  }

  return jsonOk(mapCourseListItem(row, prereqCode, enrolledCount ?? 0));
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

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => i.message).join(", "), 400);
  }

  if (parsed.data.prerequisiteId === id) {
    return jsonError("A course cannot be its own prerequisite", 400);
  }

  const sb = createServerSupabase();
  const schemaMode = await getCourseSchemaMode(sb);

  if (parsed.data.prerequisiteId && schemaMode === "full") {
    const { data: prereq, error: pErr } = await sb
      .from("courses")
      .select("id")
      .eq("id", parsed.data.prerequisiteId)
      .maybeSingle();
    if (pErr) return jsonFromPostgrestError(pErr);
    if (!prereq) return jsonError("Prerequisite course not found", 400);
  }

  const { data: existing, error: exErr } = await sb.from("courses").select("id").eq("id", id).maybeSingle();
  if (exErr) return jsonFromPostgrestError(exErr);
  if (!existing) return jsonError("Course not found", 404);

  const patch: Record<string, unknown> = {};
  if (schemaMode === "full") {
    if (parsed.data.courseCode !== undefined) patch.course_code = parsed.data.courseCode;
    if (parsed.data.description !== undefined) patch.description = parsed.data.description;
    if (parsed.data.units !== undefined) patch.units = parsed.data.units;
    if (parsed.data.prerequisiteId !== undefined) patch.prerequisite_id = parsed.data.prerequisiteId;
  } else if (parsed.data.courseCode !== undefined) {
    patch.code = parsed.data.courseCode;
  }
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.capacity !== undefined) patch.capacity = parsed.data.capacity;

  const { data, error } = await sb.from("courses").update(patch).eq("id", id).select("*").single();

  if (error) {
    if (isUniqueViolation(error)) {
      return jsonError("Course code must be unique", 409);
    }
    return jsonFromPostgrestError(error);
  }

  const row = toCourseRow(data as Record<string, unknown>, schemaMode);

  const { count: enrolledCount, error: cntErr } = await countActiveEnrollmentsForCourse(sb, id);
  if (cntErr) return jsonFromPostgrestError(cntErr);

  let prereqCode: string | null = null;
  if (row.prerequisite_id && schemaMode === "full") {
    const { data: p, error: pErr } = await sb
      .from("courses")
      .select(courseCodeColumn(schemaMode))
      .eq("id", row.prerequisite_id)
      .maybeSingle();
    if (pErr) return jsonFromPostgrestError(pErr);
    const codeRow = p as { course_code?: string; code?: string } | null;
    prereqCode = codeRow?.course_code ?? codeRow?.code ?? null;
  }

  return jsonOk(mapCourseListItem(row, prereqCode, enrolledCount ?? 0));
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const sb = createServerSupabase();
  const { data, error } = await sb.from("courses").delete().eq("id", id).select("id").maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Course not found", 404);

  return new Response(null, { status: 204 });
}
