"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Pencil, Search, Trash2, Users } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { CapacityBar } from "@/components/ui/capacity-bar";
import { apiGetCourses } from "@/lib/api/client";
import type { ApiCourseListItem } from "@/lib/types/api";
import { capacityPercent } from "@/lib/format";
import { useDataRefresh } from "@/contexts/data-refresh-context";
import { useEduUi } from "@/components/layout/edu-app-frame";

function availability(course: ApiCourseListItem) {
  const full = course.capacity > 0 && course.enrolledCount >= course.capacity;
  const pct = capacityPercent(course.enrolledCount, course.capacity);
  if (full) return { label: "Full", dot: "bg-red-500" };
  if (pct >= 75) return { label: "Limited", dot: "bg-[#c9a227]" };
  return { label: "Open", dot: "bg-emerald-500" };
}

export default function CoursesPage() {
  const { version } = useDataRefresh();
  const ui = useEduUi();
  const [rows, setRows] = useState<ApiCourseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGetCourses();
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
  }, [version]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((c) => {
      const hay = `${c.courseCode} ${c.title} ${c.prerequisiteCode ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2d3748]/50" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search courses…"
            className="w-full rounded-xl border border-[#e2e8f0] bg-white py-2 pl-10 pr-3 text-sm outline-none ring-1 ring-black/5 focus:border-[#1e4d8c]"
          />
        </label>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white p-6 text-sm text-[#2d3748] shadow-sm">
          <Spinner />
          Loading courses…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#cbd5e1] bg-white p-10 text-center shadow-sm">
          <BookOpen className="h-10 w-10 text-[#1e4d8c]/40" aria-hidden />
          <div>
            <p className="font-semibold text-[#1a3a6b]">No courses found</p>
            <p className="mt-1 text-sm text-[#2d3748]/70">
              {q.trim() ? "Try a different search." : "Add your first course with Add Course."}
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-sm ring-1 ring-black/5">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="bg-[#f8f9fc] text-xs uppercase tracking-wide text-[#2d3748]/80">
              <tr>
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Units</th>
                <th className="px-4 py-3 font-semibold">Prerequisite</th>
                <th className="px-4 py-3 font-semibold">Capacity</th>
                <th className="px-4 py-3 font-semibold">Availability</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {filtered.map((c) => {
                const a = availability(c);
                const label = `${c.courseCode} — ${c.title}`;
                return (
                  <tr key={c.id} className="text-[#2d3748]">
                    <td className="px-4 py-3 font-semibold text-[#1a3a6b]">{c.courseCode}</td>
                    <td className="px-4 py-3">{c.title}</td>
                    <td className="px-4 py-3 tabular-nums">{c.units}</td>
                    <td className="px-4 py-3">{c.prerequisiteCode ?? "—"}</td>
                    <td className="px-4 py-3">
                      <CapacityBar enrolled={c.enrolledCount} capacity={c.capacity} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-sm">
                        <span className={`h-2.5 w-2.5 rounded-full ${a.dot}`} aria-hidden />
                        {a.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          title="View students"
                          aria-label="View students"
                          onClick={() => ui.openViewCourseStudents(c.id, label)}
                          className="rounded-lg p-2 text-[#1e4d8c] ring-1 ring-black/5 hover:bg-[#f8f9fc]"
                        >
                          <Users className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Edit"
                          aria-label="Edit"
                          onClick={() => ui.openCourseEdit(c.id)}
                          className="rounded-lg p-2 text-[#1e4d8c] ring-1 ring-black/5 hover:bg-[#f8f9fc]"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          aria-label="Delete"
                          onClick={() =>
                            ui.openDelete({ kind: "course", id: c.id, label: `${c.courseCode}` })
                          }
                          className="rounded-lg p-2 text-red-700 ring-1 ring-black/5 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
