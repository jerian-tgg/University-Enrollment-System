import type { PostgrestError } from "@supabase/supabase-js";
import { isPostgrestError, postgrestErrorMessage } from "@/lib/supabase/errors";

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, { status: 200, ...init });
}

export function jsonError(message: string, status: number): Response {
  const text = message.trim() || "Request failed";
  return Response.json({ error: text }, { status });
}

export function jsonFromPostgrestError(error: PostgrestError, status = 500): Response {
  return jsonError(postgrestErrorMessage(error), status);
}

export function jsonFromUnknownError(error: unknown, status = 500): Response {
  if (isPostgrestError(error)) return jsonFromPostgrestError(error, status);
  if (error instanceof Error) return jsonError(error.message, status);
  return jsonError("Request failed", status);
}
