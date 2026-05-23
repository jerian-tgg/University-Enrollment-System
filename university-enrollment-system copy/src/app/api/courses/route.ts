import { randomUUID } from "crypto";
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
  courseOrderColumn,
  getCourseSchemaMode,
  listEnrolledCourseIds,
  toCourseRow,
} from "@/lib/supabase/enrollment-schema";
import { createServerSupabase } from "@/lib/supabase/server";
import { isUniqueViolation } from "@/lib/supabase/errors";
import { z } from "zod";

const createSchema = z.object({
  courseCode: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  capacity: z.coerce.number().int().positive(),
  units: z.coerce.number().int().positive(),
  prerequisiteIds: z.array(z.string().min(1)).optional().default([]),
});

function graphForValidation(graph: PrereqGraph, courseId: string): PrereqGraph {
  const next = new Map(graph);
  next.delete(courseId);
  return next;
}

export async function GET() {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  const sb = createServerSupabase();
  const schemaMode = await getCourseSchemaMode(sb);

  const { data: courses, error: cErr } = await sb
    .from("courses")
    .select("*")
    .order(courseOrderColumn(schemaMode));
  if (cErr) return jsonFromPostgrestError(cErr);

  const { data: enrolledRows, error: eErr } = await listEnrolledCourseIds(sb);
  if (eErr) return jsonFromPostgrestError(eErr);

  const countMap = new Map<string, number>();
  for (const r of enrolledRows ?? []) {
    const cid = (r as { course_id: string }).course_id;
    countMap.set(cid, (countMap.get(cid) ?? 0) + 1);
  }

  const list = ((courses as Record<string, unknown>[]) ?? []).map((row) =>
    toCourseRow(row, schemaMode)
  );
  const codeById = new Map(list.map((c) => [c.id, c.course_code]));

  let graph: PrereqGraph = new Map();
  if (schemaMode === "full") {
    try {
      graph = await loadPrerequisiteGraph(sb);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load prerequisites";
      return jsonError(message, 500);
    }
  }

  return jsonOk(
    list.map((c) => mapCourseWithPrerequisites(c, graph, codeById, countMap.get(c.id) ?? 0))
  );
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => i.message).join(", "), 400);
  }

  const sb = createServerSupabase();
  const schemaMode = await getCourseSchemaMode(sb);
  const prerequisiteIds = parsed.data.prerequisiteIds ?? [];

  const { data: allCourses, error: listErr } = await sb.from("courses").select("id");
  if (listErr) return jsonFromPostgrestError(listErr);
  const validIds = new Set((allCourses ?? []).map((c) => c.id as string));

  if (schemaMode === "full" && prerequisiteIds.length > 0) {
    for (const pid of prerequisiteIds) {
      if (!validIds.has(pid)) {
        return jsonError("Prerequisite course not found", 400);
      }
    }
  }

  const id = randomUUID();

  const insertPayload: Record<string, string | number | null> =
    schemaMode === "full"
      ? {
          id,
          course_code: parsed.data.courseCode,
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          capacity: parsed.data.capacity,
          units: parsed.data.units,
        }
      : {
          id,
          code: parsed.data.courseCode,
          title: parsed.data.title,
          capacity: parsed.data.capacity,
        };

  const { data, error } = await sb.from("courses").insert(insertPayload).select("*").single();

  if (error) {
    if (isUniqueViolation(error)) {
      return jsonError("Course code must be unique", 409);
    }
    return jsonFromPostgrestError(error);
  }

  const row = toCourseRow(data as Record<string, unknown>, schemaMode);

  if (schemaMode === "full") {
    validIds.add(id);
    try {
      const graph = await loadPrerequisiteGraph(sb);
      const validationError = validatePrerequisiteSelection(
        id,
        prerequisiteIds,
        graphForValidation(graph, id),
        validIds
      );
      if (validationError) {
        await sb.from("courses").delete().eq("id", id);
        return jsonError(validationError, 400);
      }
      await setCoursePrerequisites(sb, id, prerequisiteIds);
    } catch (e: unknown) {
      await sb.from("courses").delete().eq("id", id);
      const message = e instanceof Error ? e.message : "Failed to save prerequisites";
      return jsonError(message, 400);
    }
  }

  const { data: codeRows } = await sb
    .from("courses")
    .select(schemaMode === "full" ? "id, course_code" : "id, code");
  const codeById = new Map<string, string>();
  for (const c of codeRows ?? []) {
    const r = c as { id: string; course_code?: string; code?: string };
    codeById.set(r.id, r.course_code ?? r.code ?? "");
  }

  const graph = schemaMode === "full" ? await loadPrerequisiteGraph(sb) : new Map();

  return jsonOk(mapCourseWithPrerequisites(row, graph, codeById, 0));
}
