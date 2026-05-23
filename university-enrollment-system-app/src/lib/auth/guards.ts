import { jsonError } from "@/lib/api/json";
import { canAccessStudent, isAdmin } from "@/lib/auth/permissions";
import { getSession, type SessionData } from "@/lib/auth/session";

type AuthOk = { session: SessionData };
type AuthErr = { response: Response };

function unauthorized(): AuthErr {
  return { response: jsonError("Unauthorized", 401) };
}

function forbidden(): AuthErr {
  return { response: jsonError("Forbidden", 403) };
}

export async function requireAuth(): Promise<AuthOk | AuthErr> {
  const session = await getSession();
  if (!session) return unauthorized();
  return { session };
}

export async function requireAdmin(): Promise<AuthOk | AuthErr> {
  const result = await requireAuth();
  if ("response" in result) return result;
  if (!isAdmin(result.session)) return forbidden();
  return result;
}

/** Reject unless admin or the student id matches the session. */
export function requireStudentAccess(session: SessionData, studentId: string): AuthErr | null {
  if (!canAccessStudent(session, studentId)) return forbidden();
  return null;
}

export function requireAdminOnly(session: SessionData): AuthErr | null {
  if (!isAdmin(session)) return forbidden();
  return null;
}
