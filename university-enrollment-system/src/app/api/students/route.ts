import { randomUUID } from "crypto";
import { jsonError, jsonOk } from "@/lib/api/json";
import { createServerSupabase } from "@/lib/supabase/server";
import { isUniqueViolation } from "@/lib/supabase/errors";
import { mapStudent } from "@/lib/supabase/mappers";
import type { StudentRow } from "@/lib/supabase/rows";
import { z } from "zod";

const createSchema = z.object({
  studentId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
});

export async function GET() {
  const sb = createServerSupabase();
  const { data, error } = await sb.from("students").select("*").order("created_at", { ascending: false });

  if (error) {
    return jsonError(error.message, 500);
  }

  return jsonOk((data as StudentRow[]).map(mapStudent));
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
  const id = randomUUID();

  const { data, error } = await sb
    .from("students")
    .insert({
      id,
      student_id: parsed.data.studentId,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      email: parsed.data.email,
    })
    .select("*")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      return jsonError("Student ID must be unique", 409);
    }
    return jsonError(error.message, 500);
  }

  return jsonOk(mapStudent(data as StudentRow));
}
