import { EduAppFrame } from "@/components/layout/edu-app-frame";
import type { ReactNode } from "react";

export default function EduLayout({ children }: { children: ReactNode }) {
  return <EduAppFrame>{children}</EduAppFrame>;
}
