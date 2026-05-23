export const SESSION_COOKIE = "edu_session";

export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function sessionSecret(): string {
  return process.env.AUTH_SESSION_SECRET ?? "edu-enroll-dev-session-secret-change-in-production";
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
