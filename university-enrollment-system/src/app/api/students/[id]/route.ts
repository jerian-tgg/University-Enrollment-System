import { jsonError, jsonFromPostgrestError, jsonOk } from "@/lib/api/json";
import { requireAdmin, requireAuth, requireStudentAccess } from "@/lib/auth/guards";
import { getStudentSchemaMode, studentHasMiddleNameColumn, toStudentRow } from "@/lib/supabase/enrollment-schema";
import { createServerSupabase } from "@/lib/supabase/server";
import { isUniqueViolation } from "@/lib/supabase/errors";
import { mapStudent } from "@/lib/supabase/mappers";
import { formatStudentFullName } from "@/lib/format";
import { z } from "zod";

const updateSchema = z.object({
  studentId: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  middleName: z.string().optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

function normalizeMiddleName(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAuth();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const denied = requireStudentAccess(auth.session, id);
  if (denied) return denied.response;

  const sb = createServerSupabase();
  const schemaMode = await getStudentSchemaMode(sb);
  const { data, error } = await sb.from("students").select("*").eq("id", id).maybeSingle();

  if (error) return jsonFromPostgrestError(error);
  if (!data) return jsonError("Student not found", 404);

  return jsonOk(mapStudent(toStudentRow(data as Record<string, unknown>, schemaMode)));
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
  const [schemaMode, hasMiddleNameColumn] = await Promise.all([
    getStudentSchemaMode(sb),
    studentHasMiddleNameColumn(sb),
  ]);
  const { data: existing, error: exErr } = await sb.from("students").select("*").eq("id", id).maybeSingle();
  if (exErr) return jsonFromPostgrestError(exErr);
  if (!existing) return jsonError("Student not found", 404);

  const patch: Record<string, unknown> = {};
  const current = toStudentRow(existing as Record<string, unknown>, schemaMode);
  const firstName = parsed.data.firstName ?? current.first_name;
  const middleName =
    parsed.data.middleName !== undefined
      ? normalizeMiddleName(parsed.data.middleName)
      : current.middle_name;
  const lastName = parsed.data.lastName ?? current.last_name;

  if (schemaMode === "full") {
    if (parsed.data.studentId !== undefined) patch.student_id = parsed.data.studentId;
    if (parsed.data.firstName !== undefined) patch.first_name = parsed.data.firstName;
    if (hasMiddleNameColumn && parsed.data.middleName !== undefined) {
      patch.middle_name = middleName;
    }
    if (parsed.data.lastName !== undefined) patch.last_name = parsed.data.lastName;
  }

  if (
    parsed.data.firstName !== undefined ||
    parsed.data.middleName !== undefined ||
    parsed.data.lastName !== undefined
  ) {
    patch.name = formatStudentFullName({ firstName, middleName, lastName });
  }
  if (parsed.data.email !== undefined) patch.email = parsed.data.email;

  const { data, error } = await sb.from("students").update(patch).eq("id", id).select("*").single();

  if (error) {
    if (isUniqueViolation(error)) {
      return jsonError("Student ID must be unique", 409);
    }
    return jsonFromPostgrestError(error);
  }

  return jsonOk(mapStudent(toStudentRow(data as Record<string, unknown>, schemaMode)));
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const sb = createServerSupabase();
  const { data, error } = await sb.from("students").delete().eq("id", id).select("id").maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Student not found", 404);

  return new Response(null, { status: 204 });
}
