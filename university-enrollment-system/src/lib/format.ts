import { formatGradeDisplay, gradeDisplayClassName } from "@/lib/grades";
import {
  resolveEnrollmentDisplayStatus,
  type EnrollmentDisplayStatus,
  type EnrollmentStatus,
} from "@/lib/types/enrollment-status";

export function formatGrade(value: unknown): string | null {
  return formatGradeDisplay(value);
}

export { gradeDisplayClassName };

export function formatDate(iso: Date | string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export type StatusBadgeMeta = {
  label: string;
  emoji: string;
  className: string;
};

export function enrollmentDisplayBadgeMeta(display: EnrollmentDisplayStatus): StatusBadgeMeta {
  switch (display) {
    case "enrolled":
      return {
        emoji: "🔵",
        label: "Enrolled",
        className: "bg-blue-100 text-[#1e4d8c] border-blue-200",
      };
    case "passed":
      return {
        emoji: "✅",
        label: "Passed",
        className: "bg-emerald-50 text-emerald-800 border-emerald-200",
      };
    case "failed":
      return {
        emoji: "❌",
        label: "Failed",
        className: "bg-red-50 text-red-800 border-red-200",
      };
    case "incomplete":
      return {
        emoji: "⏳",
        label: "INC",
        className: "bg-amber-50 text-amber-900 border-amber-200",
      };
    case "dropped":
      return {
        emoji: "🚫",
        label: "Dropped",
        className: "bg-slate-100 text-slate-700 border-slate-200",
      };
    default: {
      const _exhaustive: never = display;
      return _exhaustive;
    }
  }
}

export function statusBadgeMeta(
  status: EnrollmentStatus,
  grade?: string | null
): StatusBadgeMeta {
  return enrollmentDisplayBadgeMeta(resolveEnrollmentDisplayStatus(status, grade));
}

export function capacityPercent(enrolled: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.min(100, Math.round((enrolled / capacity) * 1000) / 10);
}

export function capacityBarColor(pct: number, isFull: boolean): string {
  if (isFull) return "bg-red-500";
  if (pct >= 75) return "bg-[#c9a227]";
  return "bg-emerald-500";
}

export function formatStudentFullName(parts: {
  firstName: string;
  middleName?: string | null;
  lastName: string;
}): string {
  return [parts.firstName, parts.middleName?.trim() || null, parts.lastName]
    .filter((p): p is string => Boolean(p?.trim()))
    .join(" ");
}

/** Infer middle name from legacy `name` when `middle_name` column is absent. */
export function parseMiddleNameFromFullName(
  fullName: string,
  firstName: string,
  lastName: string
): string | null {
  const trimmed = fullName.trim();
  const first = firstName.trim();
  const last = lastName.trim();
  if (!trimmed || !first || !last) return null;
  if (!trimmed.startsWith(first) || !trimmed.endsWith(last)) return null;
  const middle = trimmed.slice(first.length, trimmed.length - last.length).trim();
  return middle || null;
}

export function studentNameFromRow(row: {
  first_name: string;
  middle_name?: string | null;
  last_name: string;
}): string {
  return formatStudentFullName({
    firstName: row.first_name,
    middleName: row.middle_name,
    lastName: row.last_name,
  });
}
