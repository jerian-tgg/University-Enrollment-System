import { jsonError, jsonOk } from "@/lib/api/json";
import { authenticateCredentials, sessionToClient } from "@/lib/auth/auth";
import { setSessionCookie } from "@/lib/auth/session";
import { z } from "zod";

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => i.message).join(", "), 400);
  }

  const session = await authenticateCredentials(parsed.data.username, parsed.data.password);
  if (!session) {
    return jsonError("Invalid username or password", 401);
  }

  await setSessionCookie(session);
  return jsonOk(sessionToClient(session));
}
