import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostgrestError } from "@supabase/supabase-js";
import type { CourseRow, EnrollmentRow, StudentRow } from "@/lib/supabase/rows";
import { isPostgrestError } from "@/lib/supabase/errors";

export type SchemaMode = "full" | "legacy";
export type EnrollmentSchemaMode = SchemaMode;

const globalForSchema = globalThis as unknown as {
  __enrollmentSchemaMode?: SchemaMode;
  __studentSchemaMode?: SchemaMode;
  __courseSchemaMode?: SchemaMode;
};

async function probeColumn(
  sb: SupabaseClient,
  table: "students" | "courses" | "enrollments",
  column: string
): Promise<SchemaMode> {
  const { error } = await sb.from(table).select(column).limit(1);
  return isPostgrestError(error) && error.code === "42703" ? "legacy" : "full";
}

export async function getEnrollmentSchemaMode(sb: SupabaseClient): Promise<SchemaMode> {
  if (globalForSchema.__enrollmentSchemaMode) {
    return globalForSchema.__enrollmentSchemaMode;
  }
  globalForSchema.__enrollmentSchemaMode = await probeColumn(sb, "enrollments", "status");
  return globalForSchema.__enrollmentSchemaMode;
}

export async function getStudentSchemaMode(sb: SupabaseClient): Promise<SchemaMode> {
  if (globalForSchema.__studentSchemaMode) {
    return globalForSchema.__studentSchemaMode;
  }
  globalForSchema.__studentSchemaMode = await probeColumn(sb, "students", "first_name");
  return globalForSchema.__studentSchemaMode;
}

export async function getCourseSchemaMode(sb: SupabaseClient): Promise<SchemaMode> {
  if (globalForSchema.__courseSchemaMode) {
    return globalForSchema.__courseSchemaMode;
  }
  globalForSchema.__courseSchemaMode = await probeColumn(sb, "courses", "course_code");
  return globalForSchema.__courseSchemaMode;
}

export function toStudentRow(raw: Record<string, unknown>, mode: SchemaMode): StudentRow {
  if (mode === "full") {
    return raw as unknown as StudentRow;
  }

  const name = String(raw.name ?? "").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "Unknown";
  const lastName = parts.slice(1).join(" ") || "—";

  return {
    id: String(raw.id),
    student_id: String(raw.student_id ?? raw.id),
    first_name: firstName,
    last_name: lastName,
    email: String(raw.email),
    created_at: String(raw.created_at),
  };
}

export function toCourseRow(raw: Record<string, unknown>, mode: SchemaMode): CourseRow {
  if (mode === "full") {
    return raw as unknown as CourseRow;
  }

  return {
    id: String(raw.id),
    course_code: String(raw.course_code ?? raw.code),
    title: String(raw.title),
    description: (raw.description as string | null) ?? null,
    capacity: Number(raw.capacity),
    units: Number(raw.units ?? 3),
    prerequisite_id: (raw.prerequisite_id as string | null) ?? null,
    created_at: String(raw.created_at),
  };
}

export function courseOrderColumn(mode: SchemaMode): "course_code" | "code" {
  return mode === "full" ? "course_code" : "code";
}

export function courseCodeColumn(mode: SchemaMode): "course_code" | "code" {
  return mode === "full" ? "course_code" : "code";
}

export function mapEnrollmentRow(
  raw: Record<string, unknown>,
  mode: EnrollmentSchemaMode
): EnrollmentRow {
  if (mode === "full") {
    return raw as unknown as EnrollmentRow;
  }

  return {
    id: String(raw.id),
    student_id: String(raw.student_id),
    course_id: String(raw.course_id),
    grade: raw.grade != null ? (raw.grade as string | number) : null,
    status: "enrolled",
    enrolled_at: String(raw.enrolled_at ?? raw.created_at ?? new Date().toISOString()),
  };
}

export function enrollmentOrderColumn(mode: EnrollmentSchemaMode): "enrolled_at" | "created_at" {
  return mode === "full" ? "enrolled_at" : "created_at";
}

export async function countEnrollmentsByStatus(
  sb: SupabaseClient,
  status: "enrolled" | "completed"
): Promise<{ count: number | null; error: PostgrestError | null }> {
  const mode = await getEnrollmentSchemaMode(sb);

  if (mode === "legacy") {
    if (status === "completed") {
      return { count: 0, error: null };
    }
    return sb.from("enrollments").select("*", { count: "exact", head: true });
  }

  return sb
    .from("enrollments")
    .select("*", { count: "exact", head: true })
    .eq("status", status);
}

export async function countActiveEnrollmentsForCourse(
  sb: SupabaseClient,
  courseId: string
): Promise<{ count: number | null; error: PostgrestError | null }> {
  const mode = await getEnrollmentSchemaMode(sb);
  let query = sb
    .from("enrollments")
    .select("*", { count: "exact", head: true })
    .eq("course_id", courseId);

  if (mode === "full") {
    query = query.eq("status", "enrolled");
  }

  return query;
}

export async function listEnrolledCourseIds(
  sb: SupabaseClient
): Promise<{ data: { course_id: string }[] | null; error: PostgrestError | null }> {
  const mode = await getEnrollmentSchemaMode(sb);
  let query = sb.from("enrollments").select("course_id");

  if (mode === "full") {
    query = query.eq("status", "enrolled");
  }

  const { data, error } = await query;
  return { data: data as { course_id: string }[] | null, error };
}

export const MIGRATION_HINT =
  "Database schema is out of date. Run supabase/migrations/20260520140000_align_enrollments_schema.sql in the Supabase SQL editor (or npm run db:migrate with SUPABASE_DB_PASSWORD set).";
