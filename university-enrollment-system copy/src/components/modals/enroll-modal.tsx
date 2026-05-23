"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { apiEnroll, apiGetCourses, apiGetStudentCourses } from "@/lib/api/client";
import { buildPrereqGraphFromCourses, isCourseAvailableForStudent } from "@/lib/eligibility";
import type { ApiCourseListItem, ApiStudentCourse } from "@/lib/types/api";

export function EnrollModal({
  open,
  onClose,
  studentId,
  studentLabel,
  onEnrolled,
}: {
  open: boolean;
  onClose: () => void;
  studentId: string | null;
  studentLabel: string;
  onEnrolled: () => void;
}) {
  const [courses, setCourses] = useState<ApiCourseListItem[]>([]);
  const [studentCourses, setStudentCourses] = useState<ApiStudentCourse[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !studentId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setSelectedIds(new Set());
      try {
        const [allCourses, mine] = await Promise.all([
          apiGetCourses(),
          apiGetStudentCourses(studentId),
        ]);
        if (cancelled) return;
        setCourses(allCourses);
        setStudentCourses(mine);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, studentId]);

  const prereqGraph = useMemo(() => buildPrereqGraphFromCourses(courses), [courses]);

  const eligible = useMemo(() => {
    return courses.filter((c) => isCourseAvailableForStudent(c, studentCourses, prereqGraph));
  }, [courses, studentCourses, prereqGraph]);

  const allSelected = eligible.length > 0 && eligible.every((c) => selectedIds.has(c.id));

  function toggleCourse(courseId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligible.map((c) => c.id)));
    }
  }

  async function submit() {
    if (!studentId) return;
    const ids = [...selectedIds];
    if (ids.length === 0) {
      setError("Select at least one course.");
      return;
    }
    setSaving(true);
    setError(null);
    const failures: string[] = [];
    let successCount = 0;

    try {
      for (const courseId of ids) {
        try {
          await apiEnroll({ studentId, courseId });
          successCount += 1;
        } catch (e: unknown) {
          const course = courses.find((c) => c.id === courseId);
          const label = course ? `${course.courseCode}` : courseId;
          failures.push(`${label}: ${e instanceof Error ? e.message : "Enrollment failed"}`);
        }
      }

      if (successCount > 0) {
        onEnrolled();
        const mine = await apiGetStudentCourses(studentId);
        setStudentCourses(mine);
        setSelectedIds(new Set());
      }

      if (failures.length === 0) {
        onClose();
      } else if (successCount > 0) {
        setError(
          `Enrolled in ${successCount} course${successCount === 1 ? "" : "s"}. Failed: ${failures.join("; ")}`
        );
      } else {
        setError(failures.join("; "));
      }
    } finally {
      setSaving(false);
    }
  }

  const selectedCount = selectedIds.size;

  return (
    <Modal
      open={open}
      title={`Enroll — ${studentLabel}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#cbd5e1] bg-white px-4 py-2 text-sm font-medium text-[#2d3748] hover:bg-[#f8f9fc]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving || loading || eligible.length === 0 || selectedCount === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1e4d8c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a3a6b] disabled:opacity-50"
          >
            {saving ? <Spinner className="h-4 w-4 border-white border-t-transparent" /> : null}
            {selectedCount > 0 ? `Enroll (${selectedCount})` : "Enroll"}
          </button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[#2d3748]">
          <Spinner />
          Loading…
        </div>
      ) : (
        <div className="grid gap-3">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {eligible.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              No available courses right now (capacity full, prerequisites missing, or already enrolled).
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-[#2d3748]">Select one or more courses</p>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-sm font-semibold text-[#1e4d8c] hover:underline"
                >
                  {allSelected ? "Clear all" : "Select all"}
                </button>
              </div>
              <ul className="max-h-80 space-y-2 overflow-y-auto rounded-lg border border-[#e2e8f0] bg-[#f8f9fc] p-2">
                {eligible.map((c) => {
                  const checked = selectedIds.has(c.id);
                  return (
                    <li key={c.id}>
                      <label
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border bg-white px-3 py-2.5 shadow-sm ring-1 ring-black/5 transition hover:border-[#1e4d8c]/30 ${
                          checked ? "border-[#1e4d8c]/40 ring-[#1e4d8c]/20" : "border-transparent"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCourse(c.id)}
                          className="mt-1 h-4 w-4 rounded border-[#cbd5e1] text-[#1e4d8c] focus:ring-[#1e4d8c]"
                        />
                        <span className="min-w-0 flex-1 text-sm text-[#2d3748]">
                          <span className="font-semibold text-[#1a3a6b]">
                            {c.courseCode} — {c.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-[#2d3748]/70">
                            {c.enrolledCount}/{c.capacity} enrolled
                            {c.requiredPrerequisiteCodes.length > 0
                              ? ` · Requires: ${c.requiredPrerequisiteCodes.join(", ")}`
                              : ""}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
