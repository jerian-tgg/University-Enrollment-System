"use client";

import { GraduationCap } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Spinner } from "@/components/ui/spinner";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as { error?: string; role?: string };
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      const from = searchParams.get("from");
      if (data.role === "student") {
        router.replace(from && from !== "/" && from !== "/login" ? from : "/");
      } else {
        router.replace(from && from !== "/login" ? from : "/");
      }
      router.refresh();
    } catch {
      setError("Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-4">
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-[#2d3748]">Username</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-[#2d3748] outline-none focus:border-[#1e4d8c]"
          placeholder="admin or student ID (e.g. 2026-0421-A)"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-[#2d3748]">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-[#2d3748] outline-none focus:border-[#1e4d8c]"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1e4d8c] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1a3a6b] disabled:opacity-50"
      >
        {submitting ? <Spinner className="h-4 w-4 border-white border-t-transparent" /> : null}
        Sign in
      </button>
      <p className="text-xs text-[#2d3748]/70">
        Admin: <span className="font-mono">admin</span> / <span className="font-mono">admin</span>.
        Students: use your student ID as username and <span className="font-mono">user</span> as password.
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f9fc] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[#e2e8f0] bg-white p-8 shadow-lg ring-1 ring-black/5">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1a3a6b] text-[#c9a227]">
            <GraduationCap className="h-7 w-7" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#1a3a6b]">EduEnroll</h1>
            <p className="text-sm text-[#2d3748]/70">Sign in to continue</p>
          </div>
        </div>
        <Suspense
          fallback={
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}

