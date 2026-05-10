"use client";

import type { ReactNode } from "react";
import { DataRefreshProvider } from "@/contexts/data-refresh-context";
import { ToastProvider } from "@/contexts/toast-context";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <DataRefreshProvider>{children}</DataRefreshProvider>
    </ToastProvider>
  );
}
