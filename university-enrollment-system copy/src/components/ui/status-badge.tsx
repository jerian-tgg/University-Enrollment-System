import type { EnrollmentStatus } from "@/lib/types/enrollment-status";
import { statusBadgeMeta } from "@/lib/format";

export function StatusBadge({
  status,
  grade,
}: {
  status: EnrollmentStatus;
  grade?: string | null;
}) {
  const meta = statusBadgeMeta(status, grade);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.className}`}
    >
      <span aria-hidden>{meta.emoji}</span>
      {meta.label}
    </span>
  );
}
