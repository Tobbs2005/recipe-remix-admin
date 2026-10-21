import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";

/**
 * The ONLY routes reachable without being a signed-in superadmin.
 * Everything else in the admin area is behind the Google login wall.
 */
const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/signout", "/denied"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Refreshes the auth token. Nothing may go between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const redirectTo = (path: string, params?: Record<string, string>) => {
    const target = request.nextUrl.clone();
    target.pathname = path;
    target.search = "";
    for (const [k, v] of Object.entries(params ?? {})) target.searchParams.set(k, v);
    const res = NextResponse.redirect(target);
    // Keep any refreshed auth cookies on the redirect.
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (isPublic(pathname)) {
    if (user && pathname === "/login") return redirectTo("/");
    return response;
  }

  // 1. Login wall: must be signed in with Google.
  if (!user) return redirectTo("/login", pathname === "/" ? {} : { next: pathname });

  // 2. Superadmin wall: profiles.is_superadmin must be TRUE (checked in the DB).
  const { data: isAdmin } = await supabase.rpc("is_superadmin");
  if (isAdmin !== true) return redirectTo("/denied");

  return response;
}
