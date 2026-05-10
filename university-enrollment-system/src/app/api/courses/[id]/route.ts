import { jsonError, jsonOk } from "@/lib/api/json";
import { createServerSupabase } from "@/lib/supabase/server";
import { isUniqueViolation } from "@/lib/supabase/errors";
import { mapCourseListItem } from "@/lib/supabase/mappers";
import type { CourseRow } from "@/lib/supabase/rows";
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
  const { id } = await params;
  const sb = createServerSupabase();

  const { data: course, error: cErr } = await sb.from("courses").select("*").eq("id", id).maybeSingle();
  if (cErr) return jsonError(cErr.message, 500);
  if (!course) return jsonError("Course not found", 404);

  const row = course as CourseRow;

  const { count: enrolledCount, error: cntErr } = await sb
    .from("enrollments")
    .select("*", { count: "exact", head: true })
    .eq("course_id", id)
    .eq("status", "enrolled");
  if (cntErr) return jsonError(cntErr.message, 500);

  let prereqCode: string | null = null;
  if (row.prerequisite_id) {
    const { data: p, error: pErr } = await sb
      .from("courses")
      .select("course_code")
      .eq("id", row.prerequisite_id)
      .maybeSingle();
    if (pErr) return jsonError(pErr.message, 500);
    prereqCode = p?.course_code ?? null;
  }

  return jsonOk(mapCourseListItem(row, prereqCode, enrolledCount ?? 0));
}

export async function PUT(req: Request, { params }: Params) {
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

  if (parsed.data.prerequisiteId) {
    const { data: prereq, error: pErr } = await sb
      .from("courses")
      .select("id")
      .eq("id", parsed.data.prerequisiteId)
      .maybeSingle();
    if (pErr) return jsonError(pErr.message, 500);
    if (!prereq) return jsonError("Prerequisite course not found", 400);
  }

  const { data: existing, error: exErr } = await sb.from("courses").select("id").eq("id", id).maybeSingle();
  if (exErr) return jsonError(exErr.message, 500);
  if (!existing) return jsonError("Course not found", 404);

  const patch: Record<string, unknown> = {};
  if (parsed.data.courseCode !== undefined) patch.course_code = parsed.data.courseCode;
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.capacity !== undefined) patch.capacity = parsed.data.capacity;
  if (parsed.data.units !== undefined) patch.units = parsed.data.units;
  if (parsed.data.prerequisiteId !== undefined) patch.prerequisite_id = parsed.data.prerequisiteId;

  const { data, error } = await sb.from("courses").update(patch).eq("id", id).select("*").single();

  if (error) {
    if (isUniqueViolation(error)) {
      return jsonError("Course code must be unique", 409);
    }
    return jsonError(error.message, 500);
  }

  const row = data as CourseRow;

  const { count: enrolledCount, error: cntErr } = await sb
    .from("enrollments")
    .select("*", { count: "exact", head: true })
    .eq("course_id", id)
    .eq("status", "enrolled");
  if (cntErr) return jsonError(cntErr.message, 500);

  let prereqCode: string | null = null;
  if (row.prerequisite_id) {
    const { data: p, error: pErr } = await sb
      .from("courses")
      .select("course_code")
      .eq("id", row.prerequisite_id)
      .maybeSingle();
    if (pErr) return jsonError(pErr.message, 500);
    prereqCode = p?.course_code ?? null;
  }

  return jsonOk(mapCourseListItem(row, prereqCode, enrolledCount ?? 0));
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const sb = createServerSupabase();
  const { data, error } = await sb.from("courses").delete().eq("id", id).select("id").maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Course not found", 404);

  return new Response(null, { status: 204 });
}
