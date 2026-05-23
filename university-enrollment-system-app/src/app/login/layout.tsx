import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function LoginLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (session) {
    redirect("/");
  }

  return children;
}
