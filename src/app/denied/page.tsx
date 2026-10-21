import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Egg } from "@/components/doodles";

export const metadata = { title: "No access | Recipe Remix Admin" };

export default async function DeniedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-md animate-rise rounded-[36px] border-2 border-zinc-200 bg-white p-8 text-center shadow-soft">
        <Egg className="sticker mx-auto h-20 w-20 animate-wiggle" />
        <h1 className="mt-4 text-3xl font-bold text-cocoa">Kitchen staff only</h1>
        <p className="mt-2 leading-7 text-zinc-600">
          {user ? (
            <>
              <span className="font-bold">{user.email}</span> is signed in but is not a superadmin, so the admin
              area is locked.
            </>
          ) : (
            <>You need to sign in first.</>
          )}
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          {user ? (
            <form action="/auth/signout" method="post">
              <button className="rounded-full bg-emerald-600 px-5 py-2.5 font-bold text-white shadow-pop transition hover:-translate-y-0.5 hover:bg-emerald-700">
                Sign out and switch account
              </button>
            </form>
          ) : (
            <Link href="/login" className="rounded-full bg-emerald-600 px-5 py-2.5 font-bold text-white shadow-pop">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
