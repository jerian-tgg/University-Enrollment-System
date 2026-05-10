export type EnrollmentStatus = "enrolled" | "dropped" | "completed";

const STATUSES: EnrollmentStatus[] = ["enrolled", "dropped", "completed"];

export function parseEnrollmentStatus(value: string): EnrollmentStatus | null {
  return STATUSES.includes(value as EnrollmentStatus) ? (value as EnrollmentStatus) : null;
}
