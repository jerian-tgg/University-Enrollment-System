import { createServerSupabase } from "@/lib/supabase/server";
import type { SessionData } from "@/lib/auth/session";

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin";
const STUDENT_PASSWORD = "user";

export async function authenticateCredentials(
  username: string,
  password: string
): Promise<SessionData | null> {
  const user = username.trim();
  const pass = password;

  if (user === ADMIN_USERNAME && pass === ADMIN_PASSWORD) {
    return { role: "admin" };
  }

  if (pass !== STUDENT_PASSWORD) return null;

  const quoted = `"${user.replace(/"/g, '""')}"`;
  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("students")
    .select("id")
    .or(`id.eq.${quoted},student_id.eq.${quoted}`)
    .maybeSingle();
  if (error || !data) return null;

  return { role: "student", studentId: String(data.id) };
}

export function sessionToClient(session: SessionData) {
  if (session.role === "admin") {
    return { role: "admin" as const };
  }
  return { role: "student" as const, studentId: session.studentId };
}
