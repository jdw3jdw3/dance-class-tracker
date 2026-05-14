import { NextResponse } from "next/server";

import { getSupabasePublicEnvDiagnostics } from "@/lib/supabase/env";

/**
 * Dev-only: reports whether the Node process sees Supabase public env vars
 * (helps debug “not configured” when .env.local exists but the client bundle is stale).
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const d = getSupabasePublicEnvDiagnostics();
  return NextResponse.json({
    serverProcessSeesUrl: d.urlChars > 0,
    serverProcessSeesKey: d.keyChars > 0,
    serverValidPair: d.validPair,
  });
}
