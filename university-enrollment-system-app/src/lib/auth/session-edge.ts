import type { NextRequest } from "next/server";
import type { SessionData } from "@/lib/auth/session";
import { SESSION_COOKIE, sessionSecret } from "@/lib/auth/session-shared";

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function parseSessionPayload(parsed: unknown): SessionData | null {
  if (!parsed || typeof parsed !== "object" || !("role" in parsed)) return null;
  const role = (parsed as { role: string }).role;
  if (role === "admin") return { role: "admin" };
  if (role === "student") {
    const studentId = (parsed as { studentId?: string }).studentId;
    if (typeof studentId === "string") return { role: "student", studentId };
  }
  return null;
}

/** Edge-safe session verification for middleware (Web Crypto HMAC). */
export async function getSessionFromRequestEdge(req: NextRequest): Promise<SessionData | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expectedBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encoded));
  const expected = bytesToBase64Url(expectedBuf);

  if (expected.length !== sig.length) return null;
  let ok = 0;
  for (let i = 0; i < expected.length; i++) ok |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (ok !== 0) return null;

  try {
    const json = new TextDecoder().decode(base64UrlToBytes(encoded));
    return parseSessionPayload(JSON.parse(json) as unknown);
  } catch {
    return null;
  }
}
