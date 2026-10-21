import Link from "next/link";
import { StarHistogram } from "@/components/admin/charts";
import { Avatar, Card, inputClass, PageHeader, Pager, Stars } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { displayName, fetchAll, fmtDateTime, type ProfileRow } from "@/lib/admin/data";

export const metadata = { title: "Ratings | Recipe Remix Admin" };
export const dynamic = "force-dynamic";

const PAGE = 40;

export default async function RatingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const stars = Number(params.stars);
  const starFilter = Number.isInteger(stars) && stars >= 1 && stars <= 5 ? stars : null;
  const order = params.order === "oldest" ? "oldest" : "newest";
  const page = Math.max(1, Number(params.page) || 1);

  let query = supabase
    .from("recipe_ratings")
    .select("user_id, recipe_id, stars, created_at, updated_at, recipes(id, title, user_id, avg_rating, rating_count)", { count: "exact" })
    .order("created_at", { ascending: order === "oldest" })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (starFilter) query = query.eq("stars", starFilter);

  const [{ data, count, error }, all, profiles] = await Promise.all([
    query,
    fetchAll<{ stars: number }>(supabase, "recipe_ratings", "stars, created_at"),
    fetchAll<ProfileRow>(supabase, "profiles", "id, email, first_name, last_name, avatar_url, created_at"),
  ]);
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const rows = (data ?? []) as unknown as {
    user_id: string;
    recipe_id: number;
    stars: number;
    created_at: string;
    updated_at: string;
    recipes: { id: number; title: string; user_id: string; avg_rating: number; rating_count: number } | null;
  }[];
  const dist = [1, 2, 3, 4, 5].map((s) => ({ stars: s, n: all.filter((r) => r.stars === s).length }));
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (starFilter) sp.set("stars", String(starFilter));
    if (order !== "newest") sp.set("order", order);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `/ratings?${s}` : "/ratings";
  };

  return (
    <>
      <PageHeader title="Ratings" subtitle={`${all.length} star ratings (1 to 5) across all recipes. Read-only.`} />
      <div className="grid gap-5 xl:grid-cols-3">
        <Card title="Distribution" note="Click a filter on the right to drill in.">
          <StarHistogram dist={dist} />
        </Card>

        <Card className="xl:col-span-2">
          <form className="mb-4 flex flex-wrap gap-2">
            <select name="stars" defaultValue={starFilter ?? ""} className={`${inputClass} w-auto`}>
              <option value="">All stars</option>
              {[5, 4, 3, 2, 1].map((s) => (
                <option key={s} value={s}>
                  {s} star{s > 1 ? "s" : ""}
                </option>
              ))}
            </select>
            <select name="order" defaultValue={order} className={`${inputClass} w-auto`}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            <button className="rounded-full bg-cocoa px-4 text-sm font-bold text-cream">Apply</button>
            <span className="ml-auto self-center text-sm text-zinc-500">{count ?? 0} matching</span>
          </form>
          {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                <tr className="border-b-2 border-zinc-100">
                  <th className="py-2 pr-3">Rater</th>
                  <th className="py-2 pr-3">Recipe</th>
                  <th className="py-2 pr-3">Stars</th>
                  <th className="py-2 pr-3 text-right">vs. recipe avg</th>
                  <th className="py-2 pr-3">When</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const p = byId.get(r.user_id);
                  const diff = r.recipes ? r.stars - Number(r.recipes.avg_rating) : 0;
                  return (
                    <tr key={`${r.user_id}-${r.recipe_id}`} className="border-b border-zinc-100 hover:bg-zinc-50">
                      <td className="py-2 pr-3">
                        <Link href={`/users/${r.user_id}`} className="flex items-center gap-2 font-semibold hover:underline">
                          <Avatar url={p?.avatar_url ?? null} name={displayName(p)} size="h-6 w-6" />
                          <span className="truncate">{displayName(p)}</span>
                          {r.recipes?.user_id === r.user_id && <span title="Rated their own recipe">🙈</span>}
                        </Link>
                      </td>
                      <td className="max-w-56 truncate py-2 pr-3">
                        <Link href={`/recipes/${r.recipe_id}`} className="hover:underline">
                          {r.recipes?.title ?? `#${r.recipe_id}`}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">
                        <Stars value={r.stars} />
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-zinc-600" title="This rating minus the recipe's average">
                        {r.recipes && r.recipes.rating_count > 1 ? `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}` : "–"}
                      </td>
                      <td className="py-2 pr-3 text-zinc-500">{fmtDateTime(r.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 && <p className="py-8 text-center text-sm text-zinc-500">No ratings match.</p>}
          </div>
          <Pager page={page} pages={pages} href={href} />
        </Card>
      </div>
    </>
  );
}
