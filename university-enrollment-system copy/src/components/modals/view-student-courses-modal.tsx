"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiGetStudentCourses, apiUpdateGrade } from "@/lib/api/client";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/contexts/toast-context";
import { useDataRefresh } from "@/contexts/data-refresh-context";
import { formatDate, formatGrade, gradeDisplayClassName } from "@/lib/format";
import { parseGradeInput } from "@/lib/grades";
import type { ApiStudentCourse } from "@/lib/types/api";
import type { EnrollmentStatus } from "@/lib/types/enrollment-status";

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
  const { isAdmin } = useAuth();
  const toast = useToast();
  const { bump } = useDataRefresh();
  const [rows, setRows] = useState<ApiStudentCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftGrades, setDraftGrades] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !studentId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGetStudentCourses(studentId);
        if (cancelled) return;
        setRows(data);
        const next: Record<string, string> = {};
        for (const r of data) {
          next[r.enrollmentId] = r.grade ?? "";
        }
        setDraftGrades(next);
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

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => a.courseCode.localeCompare(b.courseCode));
  }, [rows]);

  async function saveGrade(enrollmentId: string, status: EnrollmentStatus) {
    if (status === "dropped") {
      toast.push({ title: "Cannot update grades for dropped enrollments", variant: "warning" });
      return;
    }
    const raw = draftGrades[enrollmentId]?.trim() ?? "";
    const parsed = parseGradeInput(raw);
    if (!parsed.ok) {
      toast.push({ title: parsed.error, variant: "warning" });
      return;
    }

    setSavingId(enrollmentId);
    try {
      const updated = await apiUpdateGrade(enrollmentId, parsed.stored);
      setRows((prev) =>
        prev.map((r) =>
          r.enrollmentId === enrollmentId
            ? { ...r, grade: updated.grade, status: updated.status }
            : r
        )
      );
      setDraftGrades((prev) => ({ ...prev, [enrollmentId]: updated.grade ?? "" }));
      bump();
      toast.push({ title: "Grade saved", variant: "success" });
    } catch (e: unknown) {
      toast.push({
        title: "Failed to save grade",
        description: e instanceof Error ? e.message : undefined,
        variant: "error",
      });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Modal open={open} title={`Courses — ${studentLabel}`} onClose={onClose} wide>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[#2d3748]">
          <Spinner />
          Loading…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : sorted.length === 0 ? (
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
                {isAdmin ? <th className="py-2 pr-4 font-semibold"> </th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {sorted.map((r) => (
                <tr key={r.enrollmentId} className="text-[#2d3748]">
                  <td className="py-2 pr-4 font-medium text-[#1a3a6b]">{r.courseCode}</td>
                  <td className="py-2 pr-4">{r.title}</td>
                  <td className="py-2 pr-4 tabular-nums">{r.units}</td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={r.status} grade={r.grade} />
                  </td>
                  <td className="py-2 pr-4">
                    {isAdmin ? (
                      <input
                        value={draftGrades[r.enrollmentId] ?? ""}
                        onChange={(e) =>
                          setDraftGrades((prev) => ({ ...prev, [r.enrollmentId]: e.target.value }))
                        }
                        placeholder="1.0 / INC"
                        inputMode="decimal"
                        disabled={r.status === "dropped"}
                        className="w-24 rounded-lg border border-[#cbd5e1] bg-white px-2 py-1 tabular-nums outline-none focus:border-[#1e4d8c] disabled:opacity-50"
                      />
                    ) : (
                      <span className={gradeDisplayClassName(r.grade)}>
                        {formatGrade(r.grade) ?? "—"}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4">{formatDate(r.enrolledAt)}</td>
                  {isAdmin ? (
                    <td className="py-2 pr-4">
                      <button
                        type="button"
                        onClick={() => void saveGrade(r.enrollmentId, r.status)}
                        disabled={savingId === r.enrollmentId || r.status === "dropped"}
                        className="rounded-lg bg-[#c9a227] px-3 py-1 text-xs font-semibold text-[#1a3a6b] hover:bg-[#b08f1f] disabled:opacity-50"
                      >
                        {savingId === r.enrollmentId ? "Saving…" : "Save"}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
