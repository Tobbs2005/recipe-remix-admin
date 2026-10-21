import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AdminProfile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

/**
 * Second layer of the wall (the proxy is the first, RLS is the third).
 * Every admin page and server action calls this; it redirects anyone who is
 * not a signed-in user with profiles.is_superadmin = true.
 */
export const requireAdmin = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name, avatar_url, is_superadmin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_superadmin) redirect("/denied");

  return { supabase, user, profile: profile as AdminProfile };
});
