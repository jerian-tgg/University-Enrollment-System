"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/contexts/auth-context";
import { DataRefreshProvider } from "@/contexts/data-refresh-context";
import { ToastProvider } from "@/contexts/toast-context";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <DataRefreshProvider>{children}</DataRefreshProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
