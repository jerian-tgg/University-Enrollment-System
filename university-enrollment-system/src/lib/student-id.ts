import type { SupabaseClient } from "@supabase/supabase-js";
import { postgrestErrorMessage } from "@/lib/supabase/errors";

export type StudentIdSuffix = "A" | "I";

export const STUDENT_ID_PATTERN = /^\d{4}-\d{4}-[AI]$/;

/** Build one candidate: `{year}-{4 digits}-{A|I}`. */
export function formatStudentId(year: number, suffix: StudentIdSuffix, serial: number): string {
  const digits = String(serial % 10_000).padStart(4, "0");
  return `${year}-${digits}-${suffix}`;
}

function randomSerial(): number {
  return Math.floor(Math.random() * 10_000);
}

function randomSuffix(): StudentIdSuffix {
  return Math.random() < 0.5 ? "A" : "I";
}

/**
 * Generate a unique catalog student id (`student_id` column).
 * The primary key `id` stays a UUID in Supabase; this value is what users see and log in with.
 */
export async function generateUniqueStudentId(
  sb: SupabaseClient,
  year = new Date().getFullYear()
): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const candidate = formatStudentId(year, randomSuffix(), randomSerial());
    const { data, error } = await sb
      .from("students")
      .select("student_id")
      .eq("student_id", candidate)
      .maybeSingle();
    if (error) {
      throw new Error(postgrestErrorMessage(error));
    }
    if (!data) return candidate;
  }
  throw new Error("Could not generate a unique student ID. Try again.");
}
