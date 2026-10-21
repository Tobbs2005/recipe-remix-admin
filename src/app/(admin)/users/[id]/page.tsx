import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, Card, PageHeader, Pill, Stars } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { displayName, fmtDate, fmtDateTime, isSimulated, RECIPE_LIST_COLUMNS, type ProfileRow, type RecipeRow } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [{ data: profile }, { data: recipes }, { data: ratings }, { count: favCount }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("recipes").select(RECIPE_LIST_COLUMNS).eq("user_id", id).order("created_at", { ascending: false }),
    supabase
      .from("recipe_ratings")
      .select("stars, created_at, recipe_id, recipes(id, title)")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("recipe_favorites").select("*", { count: "exact", head: true }).eq("user_id", id),
  ]);
  if (!profile) notFound();
  const p = profile as ProfileRow;
  const rs = (recipes ?? []) as unknown as RecipeRow[];
  const rt = (ratings ?? []) as unknown as { stars: number; created_at: string; recipe_id: number; recipes: { id: number; title: string } | null }[];
  const avgGiven = rt.length ? rt.reduce((a, r) => a + r.stars, 0) / rt.length : 0;

  const fields: [string, React.ReactNode][] = [
    ["User id", <code key="id" className="text-xs">{p.id}</code>],
    ["Email", p.email ?? "–"],
    ["First name", p.first_name ?? "–"],
    ["Last name", p.last_name ?? "–"],
    ["Favorite category", p.favorite_category ?? "–"],
    ["Superadmin", p.is_superadmin ? "Yes" : "No"],
    ["Joined", fmtDateTime(p.created_at)],
    ["Profile updated", fmtDateTime(p.updated_at)],
  ];

  return (
    <>
      <Link href="/users" className="text-sm font-bold text-emerald-700 hover:underline">
        ← All users
      </Link>
      <div className="mt-3 flex items-center gap-4">
        <Avatar url={p.avatar_url} name={displayName(p)} size="h-16 w-16 text-xl" />
        <PageHeader
          title={displayName(p)}
          subtitle={
            <span className="flex flex-wrap gap-1.5">
              {p.is_superadmin && <Pill tone="cocoa">superadmin</Pill>}
              {isSimulated(p) && <Pill tone="lilac">simulated account</Pill>}
              <Pill>{rs.length} recipes</Pill>
              <Pill tone="butter">{rt.length} ratings · {avgGiven ? avgGiven.toFixed(2) : "–"}★ avg</Pill>
              <Pill tone="pink">{favCount ?? 0} saved</Pill>
            </span>
          }
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card title="Profile" note="Read-only. Users edit their own profile in Recipe Remix.">
          <dl className="space-y-2 text-sm">
            {fields.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-zinc-100 pb-2">
                <dt className="font-semibold text-zinc-500">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="Recipes they generated" className="xl:col-span-2">
          {rs.length ? (
            <ul className="divide-y divide-zinc-100">
              {rs.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <Link href={`/recipes/${r.id}`} className="min-w-0 truncate font-bold hover:underline">
                    {r.title}
                  </Link>
                  <span className="shrink-0 tabular-nums text-zinc-500">
                    {r.rating_count ? `${Number(r.avg_rating).toFixed(2)}★ (${r.rating_count})` : "unrated"} · {fmtDate(r.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No recipes yet.</p>
          )}
        </Card>

        <Card title="Ratings they gave" className="xl:col-span-3">
          {rt.length ? (
            <ul className="grid gap-x-6 sm:grid-cols-2">
              {rt.map((r) => (
                <li key={r.recipe_id} className="flex items-center justify-between gap-3 border-b border-zinc-100 py-2 text-sm">
                  <Link href={`/recipes/${r.recipe_id}`} className="min-w-0 truncate hover:underline">
                    {r.recipes?.title ?? `Recipe #${r.recipe_id}`}
                  </Link>
                  <span className="flex shrink-0 items-center gap-2">
                    <Stars value={r.stars} />
                    <span className="text-xs text-zinc-500">{fmtDate(r.created_at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No ratings yet.</p>
          )}
        </Card>
      </div>
    </>
  );
}
