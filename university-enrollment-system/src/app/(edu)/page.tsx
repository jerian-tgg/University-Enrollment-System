"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, Sparkles, Users } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { apiGetStats } from "@/lib/api/client";
import type { ApiStats } from "@/lib/types/api";
import { useAuth } from "@/contexts/auth-context";
import { useDataRefresh } from "@/contexts/data-refresh-context";

export default function DashboardPage() {
  const { version } = useDataRefresh();
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const s = await apiGetStats();
        if (!cancelled) setStats(s);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load stats");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [version, isAdmin]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-linear-to-r from-[#1a3a6b] to-[#1e4d8c] p-6 text-white shadow-lg">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-white/10 p-2">
              <Sparkles className="h-5 w-5 text-[#c9a227]" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Welcome back</h2>
              <p className="mt-1 max-w-2xl text-sm text-blue-100/90">
                Track enrollment health, capacity, and student progress from a single operations desk.
              </p>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[#2d3748]">
          <Spinner />
          Loading dashboard…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : stats ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total students" value={stats.totalStudents} accent="border-[#1e4d8c]" />
          <StatCard label="Total courses" value={stats.totalCourses} accent="border-[#c9a227]" />
          <StatCard label="Active enrollments" value={stats.activeEnrollments} accent="border-emerald-500" />
          <StatCard label="Completed" value={stats.completed} accent="border-blue-300" />
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <QuickCard
          href="/students"
          title="Students"
          description="Search, enroll, and maintain student records."
          icon={Users}
        />
        <QuickCard
          href="/courses"
          title="Courses"
          description="Manage catalog, prerequisites, and capacity."
          icon={BookOpen}
        />
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ring-1 ring-black/5 ${accent}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#2d3748]/70">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-[#1a3a6b]">{value}</p>
    </div>
  );
}

function QuickCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: typeof Users;
}) {
  return (
    <Link
      href={href}
      className="group flex gap-4 rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f8f9fc] text-[#1e4d8c] group-hover:bg-[#1e4d8c] group-hover:text-white">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-base font-semibold text-[#1a3a6b]">{title}</p>
        <p className="mt-1 text-sm text-[#2d3748]/80">{description}</p>
        <p className="mt-3 text-sm font-semibold text-[#c9a227]">Open →</p>
      </div>
    </Link>
  );
}
