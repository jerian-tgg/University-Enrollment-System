import type { PostgrestError } from "@supabase/supabase-js";

export function isUniqueViolation(error: unknown): boolean {
  return isPostgrestError(error) && error.code === "23505";
}

export function isStudentIdUuidTypeError(error: unknown): boolean {
  if (!isPostgrestError(error)) return false;
  const text = `${error.message} ${error.details ?? ""}`.toLowerCase();
  return text.includes("invalid input syntax for type uuid");
}

export const STUDENT_ID_UUID_MIGRATION_HINT =
  "Your database still stores student ids as UUID. Run npm run db:migrate:student-id (set SUPABASE_DB_URL from Supabase → Database → Connection string), or npm run db:migrate:student-id:sql and paste the SQL in the Supabase SQL Editor.";

export function isPostgrestError(error: unknown): error is PostgrestError {
  return typeof error === "object" && error !== null && "code" in error && "message" in error;
}

/** PostgREST sometimes returns an empty `message` for filter errors; include code/details when needed. */
export function postgrestErrorMessage(error: PostgrestError): string {
  const parts = [error.message, error.details, error.hint].filter(
    (p): p is string => typeof p === "string" && p.trim().length > 0
  );
  if (parts.length > 0) return parts.join(" — ");
  if (error.code) return `Database error (${error.code})`;
  return "Database request failed";
}
