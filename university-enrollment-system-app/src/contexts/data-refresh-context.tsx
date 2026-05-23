"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type DataRefreshContextValue = {
  version: number;
  bump: () => void;
};

const DataRefreshContext = createContext<DataRefreshContextValue | null>(null);

export function DataRefreshProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const value = useMemo(() => ({ version, bump }), [version, bump]);

  return <DataRefreshContext.Provider value={value}>{children}</DataRefreshContext.Provider>;
}

export function useDataRefresh() {
  const ctx = useContext(DataRefreshContext);
  if (!ctx) {
    throw new Error("useDataRefresh must be used within DataRefreshProvider");
  }
  return ctx;
}
