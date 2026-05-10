import { randomUUID } from "crypto";
import { jsonError, jsonOk } from "@/lib/api/json";
import { createServerSupabase } from "@/lib/supabase/server";
import { isUniqueViolation } from "@/lib/supabase/errors";
import { mapCourseListItem } from "@/lib/supabase/mappers";
import type { CourseRow } from "@/lib/supabase/rows";
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
  const sb = createServerSupabase();

  const { data: courses, error: cErr } = await sb.from("courses").select("*").order("course_code");
  if (cErr) return jsonError(cErr.message, 500);

  const { data: enrolledRows, error: eErr } = await sb
    .from("enrollments")
    .select("course_id")
    .eq("status", "enrolled");
  if (eErr) return jsonError(eErr.message, 500);

  const countMap = new Map<string, number>();
  for (const r of enrolledRows ?? []) {
    const cid = (r as { course_id: string }).course_id;
    countMap.set(cid, (countMap.get(cid) ?? 0) + 1);
  }

  const list = (courses as CourseRow[]) ?? [];
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

  if (parsed.data.prerequisiteId) {
    const { data: prereq, error: pErr } = await sb
      .from("courses")
      .select("id")
      .eq("id", parsed.data.prerequisiteId)
      .maybeSingle();
    if (pErr) return jsonError(pErr.message, 500);
    if (!prereq) return jsonError("Prerequisite course not found", 400);
  }

  const id = randomUUID();

  const { data, error } = await sb
    .from("courses")
    .insert({
      id,
      course_code: parsed.data.courseCode,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      capacity: parsed.data.capacity,
      units: parsed.data.units,
      prerequisite_id: parsed.data.prerequisiteId ?? null,
    })
    .select("*")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      return jsonError("Course code must be unique", 409);
    }
    return jsonError(error.message, 500);
  }

  const row = data as CourseRow;

  let prereqCode: string | null = null;
  if (row.prerequisite_id) {
    const { data: pRow, error: pErr } = await sb
      .from("courses")
      .select("course_code")
      .eq("id", row.prerequisite_id)
      .maybeSingle();
    if (pErr) return jsonError(pErr.message, 500);
    prereqCode = pRow?.course_code ?? null;
  }

  return jsonOk(mapCourseListItem(row, prereqCode, 0));
}
