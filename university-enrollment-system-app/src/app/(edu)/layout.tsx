import { EduAppFrame } from "@/components/layout/edu-app-frame";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function EduLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return <EduAppFrame>{children}</EduAppFrame>;
}
