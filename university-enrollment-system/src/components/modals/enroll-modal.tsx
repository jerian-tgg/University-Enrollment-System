"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { apiEnroll, apiGetCourses, apiGetStudentCourses } from "@/lib/api/client";
import { isCourseAvailableForStudent } from "@/lib/eligibility";
import type { ApiCourseListItem } from "@/lib/types/api";

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
  const [studentCourses, setStudentCourses] = useState<Awaited<ReturnType<typeof apiGetStudentCourses>>>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !studentId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setSelectedCourseId("");
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

  const eligible = useMemo(() => {
    return courses.filter((c) => isCourseAvailableForStudent(c, studentCourses));
  }, [courses, studentCourses]);

  async function submit() {
    if (!studentId) return;
    if (!selectedCourseId) {
      setError("Select a course.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiEnroll({ studentId, courseId: selectedCourseId });
      onEnrolled();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Enrollment failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={`Enroll — ${studentLabel}`}
      onClose={onClose}
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
            disabled={saving || loading || eligible.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1e4d8c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a3a6b] disabled:opacity-50"
          >
            {saving ? <Spinner className="h-4 w-4 border-white border-t-transparent" /> : null}
            Enroll
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
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-[#2d3748]">Available course</span>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-[#2d3748] outline-none focus:border-[#1e4d8c]"
              >
                <option value="">Select a course…</option>
                {eligible.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.courseCode} — {c.title} ({c.enrolledCount}/{c.capacity})
                    {c.prerequisiteCode ? ` • Prereq: ${c.prerequisiteCode}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </Modal>
  );
}
