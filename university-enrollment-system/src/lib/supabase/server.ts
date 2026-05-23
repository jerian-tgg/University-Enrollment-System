import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const globalForSb = globalThis as unknown as { __eduSb?: SupabaseClient };

function readSupabaseEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.SUPABASE_SECRET_KEY?.trim();
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const key = serviceKey ?? anonKey ?? "";

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (recommended for API routes) or NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return { url, key };
}

function createSupabaseClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Server-only Supabase client for Route Handlers.
 * Prefer SUPABASE_SERVICE_ROLE_KEY so API logic is not blocked by RLS.
 * Never expose the service role key to the browser.
 */
export function createServerSupabase(): SupabaseClient {
  const { url, key } = readSupabaseEnv();

  // Avoid caching a client created before .env.local was updated (common in local dev).
  if (process.env.NODE_ENV === "development") {
    return createSupabaseClient(url, key);
  }

  if (globalForSb.__eduSb) return globalForSb.__eduSb;

  globalForSb.__eduSb = createSupabaseClient(url, key);
  return globalForSb.__eduSb;
}
