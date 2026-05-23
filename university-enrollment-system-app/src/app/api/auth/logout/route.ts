import { jsonOk } from "@/lib/api/json";
import { clearSessionCookie } from "@/lib/auth/session";

export async function POST() {
  await clearSessionCookie();
  return jsonOk({ ok: true });
}
