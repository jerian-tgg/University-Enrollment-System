import { randomUUID } from "crypto";
import { jsonError, jsonFromPostgrestError, jsonOk } from "@/lib/api/json";
import { requireAdmin, requireAuth } from "@/lib/auth/guards";
import { isAdmin, studentIdFromSession } from "@/lib/auth/permissions";
import { getStudentSchemaMode, toStudentRow } from "@/lib/supabase/enrollment-schema";
import { createServerSupabase } from "@/lib/supabase/server";
import { isUniqueViolation } from "@/lib/supabase/errors";
import { mapStudent } from "@/lib/supabase/mappers";
import { z } from "zod";

const createSchema = z.object({
  studentId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
});

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
  const schemaMode = await getStudentSchemaMode(sb);
  const id = randomUUID();

  const insertPayload: Record<string, string> =
    schemaMode === "full"
      ? {
          id,
          student_id: parsed.data.studentId,
          first_name: parsed.data.firstName,
          last_name: parsed.data.lastName,
          email: parsed.data.email,
        }
      : {
          id,
          name: `${parsed.data.firstName} ${parsed.data.lastName}`.trim(),
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
