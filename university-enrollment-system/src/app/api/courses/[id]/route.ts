import { mapCourseWithPrerequisites } from "@/lib/course-prerequisite-map";
import {
  loadPrerequisiteGraph,
  setCoursePrerequisites,
  validatePrerequisiteSelection,
  type PrereqGraph,
} from "@/lib/prerequisites";
import { jsonError, jsonFromPostgrestError, jsonOk } from "@/lib/api/json";
import { requireAdmin, requireAuth } from "@/lib/auth/guards";
import {
  countActiveEnrollmentsForCourse,
  getCourseSchemaMode,
  toCourseRow,
} from "@/lib/supabase/enrollment-schema";
import { createServerSupabase } from "@/lib/supabase/server";
import { isUniqueViolation } from "@/lib/supabase/errors";
import { z } from "zod";

const updateSchema = z.object({
  courseCode: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  capacity: z.coerce.number().int().positive().optional(),
  units: z.coerce.number().int().positive().optional(),
  prerequisiteIds: z.array(z.string().min(1)).optional(),
});

type Params = { params: Promise<{ id: string }> };

function graphForValidation(graph: PrereqGraph, courseId: string): PrereqGraph {
  const next = new Map(graph);
  next.delete(courseId);
  return next;
}

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

  const { data: allCourses } = await sb.from("courses").select("id, course_code");
  const codeById = new Map(
    (allCourses ?? []).map((c) => [c.id as string, (c as { course_code: string }).course_code])
  );

  const graph = schemaMode === "full" ? await loadPrerequisiteGraph(sb) : new Map();

  return jsonOk(mapCourseWithPrerequisites(row, graph, codeById, enrolledCount ?? 0));
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

  const sb = createServerSupabase();
  const schemaMode = await getCourseSchemaMode(sb);

  const { data: existing, error: exErr } = await sb.from("courses").select("id").eq("id", id).maybeSingle();
  if (exErr) return jsonFromPostgrestError(exErr);
  if (!existing) return jsonError("Course not found", 404);

  if (parsed.data.prerequisiteIds !== undefined && schemaMode === "full") {
    const { data: allCourses, error: listErr } = await sb.from("courses").select("id");
    if (listErr) return jsonFromPostgrestError(listErr);
    const validIds = new Set((allCourses ?? []).map((c) => c.id as string));

    for (const pid of parsed.data.prerequisiteIds) {
      if (!validIds.has(pid)) {
        return jsonError("Prerequisite course not found", 400);
      }
    }

    try {
      const graph = await loadPrerequisiteGraph(sb);
      const validationError = validatePrerequisiteSelection(
        id,
        parsed.data.prerequisiteIds,
        graphForValidation(graph, id),
        validIds
      );
      if (validationError) return jsonError(validationError, 400);
      await setCoursePrerequisites(sb, id, parsed.data.prerequisiteIds);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save prerequisites";
      return jsonError(message, 400);
    }
  }

  const patch: Record<string, unknown> = {};
  if (schemaMode === "full") {
    if (parsed.data.courseCode !== undefined) patch.course_code = parsed.data.courseCode;
    if (parsed.data.description !== undefined) patch.description = parsed.data.description;
    if (parsed.data.units !== undefined) patch.units = parsed.data.units;
  } else if (parsed.data.courseCode !== undefined) {
    patch.code = parsed.data.courseCode;
  }
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.capacity !== undefined) patch.capacity = parsed.data.capacity;

  const { data, error } =
    Object.keys(patch).length > 0
      ? await sb.from("courses").update(patch).eq("id", id).select("*").single()
      : await sb.from("courses").select("*").eq("id", id).single();

  if (error) {
    if (isUniqueViolation(error)) {
      return jsonError("Course code must be unique", 409);
    }
    return jsonFromPostgrestError(error);
  }

  const row = toCourseRow(data as Record<string, unknown>, schemaMode);

  const { count: enrolledCount, error: cntErr } = await countActiveEnrollmentsForCourse(sb, id);
  if (cntErr) return jsonFromPostgrestError(cntErr);

  const { data: allCourses } = await sb.from("courses").select("id, course_code");
  const codeById = new Map(
    (allCourses ?? []).map((c) => [c.id as string, (c as { course_code: string }).course_code])
  );
  const graph = schemaMode === "full" ? await loadPrerequisiteGraph(sb) : new Map();

  return jsonOk(mapCourseWithPrerequisites(row, graph, codeById, enrolledCount ?? 0));
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
