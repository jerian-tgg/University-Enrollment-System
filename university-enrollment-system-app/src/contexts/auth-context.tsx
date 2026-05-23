"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ClientSession =
  | { role: "admin" }
  | { role: "student"; studentId: string }
  | null;

type AuthContextValue = {
  session: ClientSession;
  loading: boolean;
  isAdmin: boolean;
  isStudent: boolean;
  studentId: string | null;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ClientSession>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const data = (await res.json()) as ClientSession;
      setSession(data);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthContextValue>(() => {
    const isAdmin = session?.role === "admin";
    const isStudent = session?.role === "student";
    return {
      session,
      loading,
      isAdmin,
      isStudent,
      studentId: isStudent ? session.studentId : null,
      refresh,
    };
  }, [session, loading, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
