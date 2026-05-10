import { jsonError, jsonOk } from "@/lib/api/json";
import { createServerSupabase } from "@/lib/supabase/server";
import { isUniqueViolation } from "@/lib/supabase/errors";
import { mapStudent } from "@/lib/supabase/mappers";
import type { StudentRow } from "@/lib/supabase/rows";
import { z } from "zod";

const updateSchema = z.object({
  studentId: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const sb = createServerSupabase();
  const { data, error } = await sb.from("students").select("*").eq("id", id).maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Student not found", 404);

  return jsonOk(mapStudent(data as StudentRow));
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

  const sb = createServerSupabase();
  const { data: existing, error: exErr } = await sb.from("students").select("id").eq("id", id).maybeSingle();
  if (exErr) return jsonError(exErr.message, 500);
  if (!existing) return jsonError("Student not found", 404);

  const patch: Record<string, unknown> = {};
  if (parsed.data.studentId !== undefined) patch.student_id = parsed.data.studentId;
  if (parsed.data.firstName !== undefined) patch.first_name = parsed.data.firstName;
  if (parsed.data.lastName !== undefined) patch.last_name = parsed.data.lastName;
  if (parsed.data.email !== undefined) patch.email = parsed.data.email;

  const { data, error } = await sb.from("students").update(patch).eq("id", id).select("*").single();

  if (error) {
    if (isUniqueViolation(error)) {
      return jsonError("Student ID must be unique", 409);
    }
    return jsonError(error.message, 500);
  }

  return jsonOk(mapStudent(data as StudentRow));
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const sb = createServerSupabase();
  const { data, error } = await sb.from("students").delete().eq("id", id).select("id").maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Student not found", 404);

  return new Response(null, { status: 204 });
}
