import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

import { readSupabasePublicEnv } from "./env";

/**
 * Supabase client for Client Components and browser code.
 * Returns `null` if `.env.local` is missing the public Supabase variables.
 */
export function createClient(): SupabaseClient | null {
  const env = readSupabasePublicEnv();
  if (!env) return null;
  return createBrowserClient(env.url, env.anonKey);
}
