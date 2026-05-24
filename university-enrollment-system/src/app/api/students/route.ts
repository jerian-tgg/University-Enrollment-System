import { randomUUID } from "crypto";
import { jsonError, jsonFromPostgrestError, jsonOk } from "@/lib/api/json";
import { requireAdmin, requireAuth } from "@/lib/auth/guards";
import { studentIdFromSession } from "@/lib/auth/permissions";
import { generateUniqueStudentId } from "@/lib/student-id";
import { getStudentSchemaMode, studentHasMiddleNameColumn, toStudentRow } from "@/lib/supabase/enrollment-schema";
import { createServerSupabase } from "@/lib/supabase/server";
import { isUniqueViolation } from "@/lib/supabase/errors";
import { mapStudent } from "@/lib/supabase/mappers";
import { formatStudentFullName } from "@/lib/format";
import { z } from "zod";

const createSchema = z.object({
  firstName: z.string().min(1),
  middleName: z.string().optional(),
  lastName: z.string().min(1),
  email: z.string().email(),
});

function normalizeMiddleName(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function GET() {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  const sb = createServerSupabase();
  const schemaMode = await getStudentSchemaMode(sb);

  let query = sb.from("students").select("*").order("created_at", { ascending: false });
  // Students only see their own record.
  const scopedStudentId = studentIdFromSession(auth.session);
  if (scopedStudentId) {
    query = query.eq("id", scopedStudentId);
  }

  const { data, error } = await query;

  if (error) {
    return jsonFromPostgrestError(error);
  }

  return jsonOk(
    ((data as Record<string, unknown>[]) ?? []).map((row) =>
      mapStudent(toStudentRow(row, schemaMode))
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
  const [schemaMode, hasMiddleNameColumn] = await Promise.all([
    getStudentSchemaMode(sb),
    studentHasMiddleNameColumn(sb),
  ]);
  const id = randomUUID();

  let studentCatalogId: string;
  try {
    studentCatalogId = await generateUniqueStudentId(sb);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to generate student ID";
    return jsonError(message, 500);
  }

  const middleName = normalizeMiddleName(parsed.data.middleName);
  const fullName = formatStudentFullName({
    firstName: parsed.data.firstName,
    middleName,
    lastName: parsed.data.lastName,
  });
  const insertPayload: Record<string, string | null> =
    schemaMode === "full"
      ? {
          id,
          student_id: studentCatalogId,
          name: fullName,
          first_name: parsed.data.firstName,
          last_name: parsed.data.lastName,
          email: parsed.data.email,
          ...(hasMiddleNameColumn ? { middle_name: middleName } : {}),
        }
      : {
          id,
          name: fullName,
          email: parsed.data.email,
        };

  const { data, error } = await sb.from("students").insert(insertPayload).select("*").single();

  if (error) {
    if (isUniqueViolation(error)) {
      return jsonError("Student ID must be unique", 409);
    }
    return jsonFromPostgrestError(error);
  }

  return jsonOk(mapStudent(toStudentRow(data as Record<string, unknown>, schemaMode)));
}
