import type { EnrollmentStatus } from "@/lib/types/enrollment-status";
import { statusBadgeMeta } from "@/lib/format";

export function StatusBadge({ status }: { status: EnrollmentStatus }) {
  const meta = statusBadgeMeta(status);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.className}`}
    >
      <span aria-hidden>{meta.emoji}</span>
      {meta.label}
    </span>
  );
}
