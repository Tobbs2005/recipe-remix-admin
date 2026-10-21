import Link from "next/link";
import { Pot } from "@/components/doodles";
import { AdminNav } from "@/components/admin/nav";
import { requireAdmin } from "@/lib/admin/auth";
import { displayName } from "@/lib/admin/data";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-4 sm:px-6 lg:flex-row lg:py-8">
      <aside className="flex flex-col gap-4 lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)] lg:w-56 lg:shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <Pot className="h-10 w-10" />
          <span className="leading-tight">
            <span className="block font-display text-lg font-semibold text-cocoa">
              Recipe <span className="text-emerald-600">Remix</span>
            </span>
            <span className="block text-xs font-bold uppercase tracking-widest text-zinc-500">Admin</span>
          </span>
        </Link>
        <AdminNav />
        <div className="mt-auto hidden rounded-3xl border-2 border-zinc-200 bg-white p-3 text-sm lg:block">
          <div className="flex items-center gap-2">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-200 font-bold text-emerald-800">
                {displayName(profile).charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-bold">{displayName(profile)}</p>
              <p className="text-xs font-bold text-emerald-700">Superadmin</p>
            </div>
          </div>
          <form action="/auth/signout" method="post" className="mt-2">
            <button className="w-full rounded-full border-2 border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-600 hover:border-emerald-300 hover:text-cocoa">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 pb-16">{children}</main>
      <form action="/auth/signout" method="post" className="lg:hidden">
        <button className="w-full rounded-full border-2 border-zinc-200 bg-white px-3 py-2 text-sm font-bold text-zinc-600">
          Sign out ({displayName(profile)})
        </button>
      </form>
    </div>
  );
}
