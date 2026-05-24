"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiGetCourseStudents } from "@/lib/api/client";
import { formatGrade, formatStudentFullName, gradeDisplayClassName } from "@/lib/format";
import type { ApiCourseStudent } from "@/lib/types/api";

export function ViewCourseStudentsModal({
  open,
  courseLabel,
  onClose,
  courseId,
}: {
  open: boolean;
  courseLabel: string;
  onClose: () => void;
  courseId: string | null;
}) {
  const [rows, setRows] = useState<ApiCourseStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !courseId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGetCourseStudents(courseId);
        if (!cancelled) setRows(data);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load students");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, courseId]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));
  }, [rows]);

  return (
    <Modal open={open} title={`Students — ${courseLabel}`} onClose={onClose} wide>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[#2d3748]">
          <Spinner />
          Loading…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-[#2d3748]">
          <p className="font-medium">No students enrolled</p>
          <p className="text-xs opacity-80">Enrollments will appear here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#e2e8f0] text-xs uppercase tracking-wide text-[#2d3748]">
              <tr>
                <th className="py-2 pr-4 font-semibold">Student ID</th>
                <th className="py-2 pr-4 font-semibold">Name</th>
                <th className="py-2 pr-4 font-semibold">Email</th>
                <th className="py-2 pr-4 font-semibold">Status</th>
                <th className="py-2 pr-4 font-semibold">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {sorted.map((r) => (
                <tr key={r.enrollmentId} className="text-[#2d3748]">
                  <td className="py-2 pr-4 font-medium text-[#1a3a6b]">{r.studentCatalogId}</td>
                  <td className="py-2 pr-4">
                    {formatStudentFullName(r)}
                  </td>
                  <td className="py-2 pr-4">{r.email}</td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={r.status} grade={r.grade} />
                  </td>
                  <td className={gradeDisplayClassName(r.grade, "py-2 pr-4")}>
                    {formatGrade(r.grade) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-[#2d3748]/70">
            To set or update grades, open the student&apos;s courses from the Students page.
          </p>
        </div>
      )}
    </Modal>
  );
}
