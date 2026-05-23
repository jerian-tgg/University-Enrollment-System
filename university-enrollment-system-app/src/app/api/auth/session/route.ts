import { jsonOk } from "@/lib/api/json";
import { sessionToClient } from "@/lib/auth/auth";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return jsonOk(null);
  }
  return jsonOk(sessionToClient(session));
}
