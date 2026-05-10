import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const globalForSb = globalThis as unknown as { __eduSb?: SupabaseClient };

/**
 * Server-only Supabase client for Route Handlers.
 * Prefer SUPABASE_SERVICE_ROLE_KEY so API logic is not blocked by RLS.
 * Never expose the service role key to the browser.
 */
export function createServerSupabase(): SupabaseClient {
  if (globalForSb.__eduSb) return globalForSb.__eduSb;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const key = serviceKey ?? anonKey;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (recommended for API routes) or NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  globalForSb.__eduSb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return globalForSb.__eduSb;
}
