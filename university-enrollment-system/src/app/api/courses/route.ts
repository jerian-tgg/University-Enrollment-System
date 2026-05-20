import { randomUUID } from "crypto";
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
import { mapCourseListItem } from "@/lib/supabase/mappers";
import { z } from "zod";

const createSchema = z.object({
  courseCode: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  capacity: z.coerce.number().int().positive(),
  units: z.coerce.number().int().positive(),
  prerequisiteId: z.string().optional().nullable(),
});

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

  return jsonOk(
    list.map((c) =>
      mapCourseListItem(
        c,
        c.prerequisite_id ? (codeById.get(c.prerequisite_id) ?? null) : null,
        countMap.get(c.id) ?? 0
      )
    )
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

  if (parsed.data.prerequisiteId && schemaMode === "full") {
    const { data: prereq, error: pErr } = await sb
      .from("courses")
      .select("id")
      .eq("id", parsed.data.prerequisiteId)
      .maybeSingle();
    if (pErr) return jsonError(pErr.message, 500);
    if (!prereq) return jsonError("Prerequisite course not found", 400);
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
          prerequisite_id: parsed.data.prerequisiteId ?? null,
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

  let prereqCode: string | null = null;
  if (row.prerequisite_id && schemaMode === "full") {
    const { data: pRow, error: pErr } = await sb
      .from("courses")
      .select("course_code")
      .eq("id", row.prerequisite_id)
      .maybeSingle();
    if (pErr) return jsonFromPostgrestError(pErr);
    prereqCode = pRow?.course_code ?? null;
  }

  return jsonOk(mapCourseListItem(row, prereqCode, 0));
}
