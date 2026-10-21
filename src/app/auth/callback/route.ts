import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Google OAuth lands here with ?code=; swap it for a session cookie. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/";
  // Relative paths only, so this can't be used as an open redirect.
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);

  // The proxy decides between the admin area and /denied on the next request.
  return NextResponse.redirect(`${origin}${next}`);
}
