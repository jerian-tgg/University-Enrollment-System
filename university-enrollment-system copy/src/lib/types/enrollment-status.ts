import { isFailedGrade, isIncompleteGrade } from "@/lib/grades";

export type EnrollmentStatus = "enrolled" | "dropped" | "completed";

/** UI label derived from stored status + grade. */
export type EnrollmentDisplayStatus = "enrolled" | "dropped" | "passed" | "failed" | "incomplete";

const STATUSES: EnrollmentStatus[] = ["enrolled", "dropped", "completed"];

export function parseEnrollmentStatus(value: string): EnrollmentStatus | null {
  return STATUSES.includes(value as EnrollmentStatus) ? (value as EnrollmentStatus) : null;
}

export function resolveEnrollmentDisplayStatus(
  status: EnrollmentStatus,
  grade: string | null | undefined
): EnrollmentDisplayStatus {
  if (status === "dropped") return "dropped";
  if (status === "completed") {
    if (isFailedGrade(grade)) return "failed";
    return "passed";
  }
  if (isIncompleteGrade(grade)) return "incomplete";
  return "enrolled";
}
