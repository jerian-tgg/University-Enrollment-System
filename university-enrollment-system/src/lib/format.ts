import type { EnrollmentStatus } from "@/lib/types/enrollment-status";

export function formatGrade(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return null;
  return n.toFixed(2);
}

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

export function statusBadgeMeta(status: EnrollmentStatus): StatusBadgeMeta {
  switch (status) {
    case "enrolled":
      return {
        emoji: "🔵",
        label: "Enrolled",
        className: "bg-blue-100 text-[#1e4d8c] border-blue-200",
      };
    case "completed":
      return {
        emoji: "✅",
        label: "Completed",
        className: "bg-emerald-50 text-emerald-800 border-emerald-200",
      };
    case "dropped":
      return {
        emoji: "❌",
        label: "Dropped",
        className: "bg-red-50 text-red-800 border-red-200",
      };
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
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
