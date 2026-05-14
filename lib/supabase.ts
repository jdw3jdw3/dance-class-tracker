/**
 * Browser Supabase client for Client Components.
 * Uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `.env.local`.
 * Returns `null` when either variable is missing (see `MissingSupabaseEnvScreen` in `app/page.tsx`).
 */
export { createClient } from "./supabase/client";
