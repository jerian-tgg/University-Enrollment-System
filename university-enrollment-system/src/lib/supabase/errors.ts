import type { PostgrestError } from "@supabase/supabase-js";

export function isUniqueViolation(error: unknown): boolean {
  return isPostgrestError(error) && error.code === "23505";
}

export function isPostgrestError(error: unknown): error is PostgrestError {
  return typeof error === "object" && error !== null && "code" in error && "message" in error;
}
