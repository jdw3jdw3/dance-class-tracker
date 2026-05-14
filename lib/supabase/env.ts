/**
 * Reads Supabase URL + anon key from the environment (e.g. `.env.local`).
 * Returns `null` if either value is missing so the UI can explain instead of crashing.
 *
 * Strips BOM, whitespace, and optional surrounding quotes (common when copy-pasting).
 */
export function normalizePublicEnvValue(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  let v = value.replace(/^\uFEFF/, "").trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v.length > 0 ? v : undefined;
}

export function readSupabasePublicEnv():
  | { url: string; anonKey: string }
  | null {
  const url = normalizePublicEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = normalizePublicEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/** Same values as {@link readSupabasePublicEnv}, but throws if unset (for server code). */
export function getSupabasePublicEnv() {
  const env = readSupabasePublicEnv();
  if (!env) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local (see Supabase Project Settings → API).",
    );
  }
  return env;
}

/** Safe lengths for UI diagnostics (does not expose secrets). */
export function getSupabasePublicEnvDiagnostics() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return {
    urlChars: rawUrl?.length ?? 0,
    keyChars: rawKey?.length ?? 0,
    urlAfterNormalize: Boolean(normalizePublicEnvValue(rawUrl)),
    keyAfterNormalize: Boolean(normalizePublicEnvValue(rawKey)),
    validPair: readSupabasePublicEnv() !== null,
  };
}
