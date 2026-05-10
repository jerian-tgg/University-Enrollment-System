"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Search } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiDropEnrollment, apiGetEnrollments } from "@/lib/api/client";
import type { ApiEnrollmentRow } from "@/lib/types/api";
import { formatDate, formatGrade } from "@/lib/format";
import { useDataRefresh } from "@/contexts/data-refresh-context";
import { useToast } from "@/contexts/toast-context";

export default function EnrollmentsPage() {
  const { version, bump } = useDataRefresh();
  const toast = useToast();
  const [rows, setRows] = useState<ApiEnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [droppingId, setDroppingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGetEnrollments();
        if (!cancelled) setRows(data);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load enrollments");
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
    return rows.filter((r) => {
      const hay =
        `${r.studentCatalogId} ${r.studentName} ${r.courseCode} ${r.courseTitle} ${r.status} ${r.grade ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q]);

  async function drop(row: ApiEnrollmentRow) {
    if (row.status !== "enrolled") {
      toast.push({ title: "Only active enrollments can be dropped", variant: "warning" });
      return;
    }
    setDroppingId(row.id);
    try {
      await apiDropEnrollment({ studentId: row.studentId, courseId: row.courseId });
      bump();
      toast.push({ title: "Enrollment dropped", variant: "success" });
    } catch (e: unknown) {
      toast.push({
        title: "Drop failed",
        description: e instanceof Error ? e.message : undefined,
        variant: "error",
      });
    } finally {
      setDroppingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2d3748]/50" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search enrollments…"
            className="w-full rounded-xl border border-[#e2e8f0] bg-white py-2 pl-10 pr-3 text-sm outline-none ring-1 ring-black/5 focus:border-[#1e4d8c]"
          />
        </label>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white p-6 text-sm text-[#2d3748] shadow-sm">
          <Spinner />
          Loading enrollments…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#cbd5e1] bg-white p-10 text-center shadow-sm">
          <ClipboardList className="h-10 w-10 text-[#1e4d8c]/40" aria-hidden />
          <div>
            <p className="font-semibold text-[#1a3a6b]">No enrollments found</p>
            <p className="mt-1 text-sm text-[#2d3748]/70">
              {q.trim() ? "Try a different search." : "Enrollments will appear here as students join courses."}
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-sm ring-1 ring-black/5">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="bg-[#f8f9fc] text-xs uppercase tracking-wide text-[#2d3748]/80">
              <tr>
                <th className="px-4 py-3 font-semibold">Student ID</th>
                <th className="px-4 py-3 font-semibold">Student</th>
                <th className="px-4 py-3 font-semibold">Course</th>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Grade</th>
                <th className="px-4 py-3 font-semibold">Enrolled</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {filtered.map((r) => (
                <tr key={r.id} className="text-[#2d3748]">
                  <td className="px-4 py-3 font-medium tabular-nums text-[#1a3a6b]">{r.studentCatalogId}</td>
                  <td className="px-4 py-3">{r.studentName}</td>
                  <td className="px-4 py-3 font-semibold text-[#1a3a6b]">{r.courseCode}</td>
                  <td className="px-4 py-3">{r.courseTitle}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatGrade(r.grade) ?? "—"}</td>
                  <td className="px-4 py-3">{formatDate(r.enrolledAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void drop(r)}
                      disabled={r.status !== "enrolled" || droppingId === r.id}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-40"
                    >
                      {droppingId === r.id ? "Dropping…" : "Drop"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
