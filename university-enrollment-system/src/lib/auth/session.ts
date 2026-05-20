import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  sessionCookieOptions,
  sessionSecret,
} from "@/lib/auth/session-shared";

export type AuthRole = "admin" | "student";

export type SessionData =
  | { role: "admin" }
  | { role: "student"; studentId: string };

export { SESSION_COOKIE, SESSION_MAX_AGE };

function signPayload(encoded: string): string {
  return createHmac("sha256", sessionSecret()).update(encoded).digest("base64url");
}

export function encodeSession(session: SessionData): string {
  const encoded = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${encoded}.${signPayload(encoded)}`;
}

export function decodeSession(token: string | undefined | null): SessionData | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = signPayload(encoded);
  try {
    const a = Buffer.from(sig, "base64url");
    const b = Buffer.from(expected, "base64url");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || !("role" in parsed)) return null;
    const role = (parsed as { role: string }).role;
    if (role === "admin") return { role: "admin" };
    if (role === "student") {
      const studentId = (parsed as { studentId?: string }).studentId;
      if (typeof studentId === "string") return { role: "student", studentId };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionData | null> {
  const jar = await cookies();
  return decodeSession(jar.get(SESSION_COOKIE)?.value);
}

export async function setSessionCookie(session: SessionData): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, encodeSession(session), sessionCookieOptions(SESSION_MAX_AGE));
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
}
