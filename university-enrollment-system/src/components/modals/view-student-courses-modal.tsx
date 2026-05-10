"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiGetStudentCourses } from "@/lib/api/client";
import { formatDate, formatGrade } from "@/lib/format";
import type { ApiStudentCourse } from "@/lib/types/api";

export function ViewStudentCoursesModal({
  open,
  studentLabel,
  onClose,
  studentId,
}: {
  open: boolean;
  studentLabel: string;
  onClose: () => void;
  studentId: string | null;
}) {
  const [rows, setRows] = useState<ApiStudentCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !studentId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGetStudentCourses(studentId);
        if (!cancelled) setRows(data);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load courses");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, studentId]);

  return (
    <Modal open={open} title={`Courses — ${studentLabel}`} onClose={onClose} wide>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[#2d3748]">
          <Spinner />
          Loading…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-[#2d3748]">
          <p className="font-medium">No enrollments yet</p>
          <p className="text-xs opacity-80">This student is not enrolled in any course.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#e2e8f0] text-xs uppercase tracking-wide text-[#2d3748]">
              <tr>
                <th className="py-2 pr-4 font-semibold">Code</th>
                <th className="py-2 pr-4 font-semibold">Title</th>
                <th className="py-2 pr-4 font-semibold">Units</th>
                <th className="py-2 pr-4 font-semibold">Status</th>
                <th className="py-2 pr-4 font-semibold">Grade</th>
                <th className="py-2 pr-4 font-semibold">Enrolled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {rows.map((r) => (
                <tr key={`${r.courseId}-${r.status}-${r.enrolledAt}`} className="text-[#2d3748]">
                  <td className="py-2 pr-4 font-medium text-[#1a3a6b]">{r.courseCode}</td>
                  <td className="py-2 pr-4">{r.title}</td>
                  <td className="py-2 pr-4 tabular-nums">{r.units}</td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="py-2 pr-4 tabular-nums">{formatGrade(r.grade) ?? "—"}</td>
                  <td className="py-2 pr-4">{formatDate(r.enrolledAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
