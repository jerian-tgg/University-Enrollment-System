import type { SessionData } from "@/lib/auth/session";

export function isAdmin(session: SessionData): boolean {
  return session.role === "admin";
}

export function isStudent(session: SessionData): boolean {
  return session.role === "student";
}

/** True when the session may access the given student's records. */
export function canAccessStudent(session: SessionData, studentId: string): boolean {
  if (session.role === "admin") return true;
  return session.studentId === studentId;
}

/** Student sessions are pinned to their own id; admins may pass any id. */
export function resolveStudentIdForMutation(session: SessionData, requestedStudentId: string): string | null {
  if (session.role === "admin") return requestedStudentId;
  if (session.studentId === requestedStudentId) return session.studentId;
  return null;
}

/** Fields a student may change on their own profile (not catalog studentId). */
export const STUDENT_SELF_EDIT_FIELDS = ["firstName", "lastName", "email"] as const;

export function studentIdFromSession(session: SessionData): string | null {
  return session.role === "student" ? session.studentId : null;
}
