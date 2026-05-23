"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BookOpen, Pencil, Search, Trash2, UserPlus, Users } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { formatDate } from "@/lib/format";
import { apiGetStudents } from "@/lib/api/client";
import type { ApiStudent } from "@/lib/types/api";
import { useAuth } from "@/contexts/auth-context";
import { useDataRefresh } from "@/contexts/data-refresh-context";
import { useEduUi } from "@/components/layout/edu-app-frame";

export default function StudentsPage() {
  const { version } = useDataRefresh();
  const ui = useEduUi();
  const { isAdmin, isStudent, studentId } = useAuth();
  const [rows, setRows] = useState<ApiStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGetStudents();
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
  }, [version]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((s) => {
      const hay = `${s.firstName} ${s.lastName} ${s.email} ${s.studentId}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q]);

  const profile = isStudent && rows.length > 0 ? rows[0] : null;

  if (isStudent) {
    const label = profile ? `${profile.firstName} ${profile.lastName}` : "Student";
    return (
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white p-6 text-sm text-[#2d3748] shadow-sm">
            <Spinner />
            Loading profile…
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : !profile ? (
          <p className="text-sm text-[#2d3748]/80">No student profile found for your account.</p>
        ) : (
          <div className="rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1e4d8c]/10 text-lg font-semibold text-[#1e4d8c]">
                  {`${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`.toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#1a3a6b]">{label}</h2>
                  <p className="mt-1 text-sm text-[#2d3748]/80">{profile.email}</p>
                  <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-[#2d3748]/60">
                        Student ID
                      </dt>
                      <dd className="font-medium tabular-nums text-[#1a3a6b]">{profile.studentId}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-[#2d3748]/60">
                        Registered
                      </dt>
                      <dd>{formatDate(profile.createdAt)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              {studentId ? (
                <button
                  type="button"
                  onClick={() => ui.openViewStudentCourses(studentId, label)}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#1e4d8c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a3a6b]"
                >
                  <BookOpen className="h-4 w-4" />
                  My courses
                </button>
              ) : null}
            </div>
            <p className="mt-4 text-xs text-[#2d3748]/60">
              Profile is read-only. Enroll or drop courses from Courses or Enrollments.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isAdmin ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2d3748]/50" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search students…"
              className="w-full rounded-xl border border-[#e2e8f0] bg-white py-2 pl-10 pr-3 text-sm outline-none ring-1 ring-black/5 focus:border-[#1e4d8c]"
            />
          </label>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white p-6 text-sm text-[#2d3748] shadow-sm">
          <Spinner />
          Loading students…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#cbd5e1] bg-white p-10 text-center shadow-sm">
          <Users className="h-10 w-10 text-[#1e4d8c]/40" aria-hidden />
          <div>
            <p className="font-semibold text-[#1a3a6b]">No students found</p>
            <p className="mt-1 text-sm text-[#2d3748]/70">
              {q.trim() ? "Try a different search." : "Add your first student with Add Student."}
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-sm ring-1 ring-black/5">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="bg-[#f8f9fc] text-xs uppercase tracking-wide text-[#2d3748]/80">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Student ID</th>
                <th className="px-4 py-3 font-semibold">Registered</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {filtered.map((s) => {
                const initials = `${s.firstName[0] ?? ""}${s.lastName[0] ?? ""}`.toUpperCase();
                const label = `${s.firstName} ${s.lastName}`;
                return (
                  <tr key={s.id} className="text-[#2d3748]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1e4d8c]/10 text-sm font-semibold text-[#1e4d8c]">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[#1a3a6b]">{label}</p>
                          <p className="truncate text-xs text-[#2d3748]/70">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums text-[#1a3a6b]">{s.studentId}</td>
                    <td className="px-4 py-3">{formatDate(s.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <IconButton
                          label="View courses"
                          onClick={() => ui.openViewStudentCourses(s.id, label)}
                        >
                          <BookOpen className="h-4 w-4" />
                        </IconButton>
                        <IconButton label="Enroll" onClick={() => ui.openEnrollStudent(s.id, label)}>
                          <UserPlus className="h-4 w-4" />
                        </IconButton>
                        <IconButton label="Edit" onClick={() => ui.openStudentEdit(s.id)}>
                          <Pencil className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          label="Delete"
                          onClick={() =>
                            ui.openDelete({ kind: "student", id: s.id, label: `${label} (${s.studentId})` })
                          }
                          danger
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
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

function IconButton({
  children,
  label,
  onClick,
  danger,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`rounded-lg p-2 ring-1 ring-black/5 transition ${
        danger
          ? "text-red-700 hover:bg-red-50"
          : "text-[#1e4d8c] hover:bg-[#f8f9fc]"
      }`}
    >
      {children}
    </button>
  );
}
