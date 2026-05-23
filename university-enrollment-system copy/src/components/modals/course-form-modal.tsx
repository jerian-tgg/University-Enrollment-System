"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import {
  apiCreateCourse,
  apiGetCourse,
  apiGetCourses,
  apiUpdateCourse,
} from "@/lib/api/client";
import type { ApiCourseListItem } from "@/lib/types/api";

export function CourseFormModal({
  open,
  onClose,
  editingId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editingId: string | null;
  onSaved: () => void;
}) {
  const [courses, setCourses] = useState<ApiCourseListItem[]>([]);
  const [courseCode, setCourseCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("40");
  const [units, setUnits] = useState("3");
  const [prerequisiteId, setPrerequisiteId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prerequisiteOptions = useMemo(() => {
    return courses.filter((c) => (editingId ? c.id !== editingId : true));
  }, [courses, editingId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await apiGetCourses();
        if (cancelled) return;
        setCourses(list);
        if (!editingId) {
          setCourseCode("");
          setTitle("");
          setDescription("");
          setCapacity("40");
          setUnits("3");
          setPrerequisiteId("");
          return;
        }
        const c = await apiGetCourse(editingId);
        if (cancelled) return;
        setCourseCode(c.courseCode);
        setTitle(c.title);
        setDescription(c.description ?? "");
        setCapacity(String(c.capacity));
        setUnits(String(c.units));
        setPrerequisiteId(c.prerequisiteId ?? "");
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load course data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, editingId]);

  async function submit() {
    setError(null);
    if (!courseCode.trim() || !title.trim()) {
      setError("Course code and title are required.");
      return;
    }
    const cap = Number(capacity);
    const u = Number(units);
    if (!Number.isFinite(cap) || cap <= 0 || !Number.isFinite(u) || u <= 0) {
      setError("Capacity and units must be positive numbers.");
      return;
    }

    setSaving(true);
    try {
      const prereq = prerequisiteId ? prerequisiteId : null;
      if (editingId) {
        await apiUpdateCourse(editingId, {
          courseCode,
          title,
          description: description.trim() ? description : null,
          capacity: cap,
          units: u,
          prerequisiteId: prereq,
        });
      } else {
        await apiCreateCourse({
          courseCode,
          title,
          description: description.trim() ? description : null,
          capacity: cap,
          units: u,
          prerequisiteId: prereq,
        });
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const modalTitle = editingId ? "Edit course" : "Add course";

  return (
    <Modal
      open={open}
      title={modalTitle}
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
            disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1e4d8c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a3a6b] disabled:opacity-50"
          >
            {saving ? <Spinner className="h-4 w-4 border-white border-t-transparent" /> : null}
            Save
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
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-[#2d3748]">Course code</span>
              <input
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-[#2d3748] outline-none focus:border-[#1e4d8c]"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-[#2d3748]">Units</span>
              <input
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                inputMode="numeric"
                className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-[#2d3748] outline-none focus:border-[#1e4d8c]"
              />
            </label>
          </div>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-[#2d3748]">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-[#2d3748] outline-none focus:border-[#1e4d8c]"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-[#2d3748]">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-[#2d3748] outline-none focus:border-[#1e4d8c]"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-[#2d3748]">Capacity</span>
              <input
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                inputMode="numeric"
                className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-[#2d3748] outline-none focus:border-[#1e4d8c]"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-[#2d3748]">Prerequisite</span>
              <select
                value={prerequisiteId}
                onChange={(e) => setPrerequisiteId(e.target.value)}
                className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-[#2d3748] outline-none focus:border-[#1e4d8c]"
              >
                <option value="">None</option>
                {prerequisiteOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.courseCode} — {c.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}
    </Modal>
  );
}
