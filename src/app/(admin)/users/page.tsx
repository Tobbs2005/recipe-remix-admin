import Link from "next/link";
import { Avatar, Card, inputClass, PageHeader, Pill } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { displayName, fetchAll, fmtDate, isSimulated, type ProfileRow } from "@/lib/admin/data";

export const metadata = { title: "Users | Recipe Remix Admin" };
export const dynamic = "force-dynamic";

const SORTS = {
  newest: "Newest",
  recipes: "Most recipes",
  ratings: "Most ratings",
  name: "Name",
} as const;
type Sort = keyof typeof SORTS;

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const q = (params.q ?? "").trim().toLowerCase();
  const sort: Sort = params.sort && params.sort in SORTS ? (params.sort as Sort) : "newest";
  const who = params.who ?? "all";

  const [profiles, recipes, ratings] = await Promise.all([
    fetchAll<ProfileRow>(supabase, "profiles", "*"),
    fetchAll<{ user_id: string }>(supabase, "recipes", "user_id, created_at"),
    fetchAll<{ user_id: string; stars: number }>(supabase, "recipe_ratings", "user_id, stars, created_at"),
  ]);

  const recipeCount = new Map<string, number>();
  recipes.forEach((r) => recipeCount.set(r.user_id, (recipeCount.get(r.user_id) ?? 0) + 1));
  const rated = new Map<string, number[]>();
  ratings.forEach((r) => rated.set(r.user_id, [...(rated.get(r.user_id) ?? []), r.stars]));

  let rows = profiles.map((p) => {
    const stars = rated.get(p.id) ?? [];
    return {
      p,
      recipes: recipeCount.get(p.id) ?? 0,
      ratings: stars.length,
      avgGiven: stars.length ? stars.reduce((a, b) => a + b, 0) / stars.length : null,
    };
  });
  if (q) {
    rows = rows.filter(({ p }) =>
      [p.email, p.first_name, p.last_name, p.favorite_category, p.id].some((v) => v?.toLowerCase().includes(q))
    );
  }
  if (who === "real") rows = rows.filter(({ p }) => !isSimulated(p));
  if (who === "simulated") rows = rows.filter(({ p }) => isSimulated(p));
  if (who === "admins") rows = rows.filter(({ p }) => p.is_superadmin);
  rows.sort((a, b) =>
    sort === "recipes"
      ? b.recipes - a.recipes
      : sort === "ratings"
        ? b.ratings - a.ratings
        : sort === "name"
          ? displayName(a.p).localeCompare(displayName(b.p))
          : b.p.created_at.localeCompare(a.p.created_at)
  );

  const simulated = profiles.filter(isSimulated).length;

  return (
    <>
      <PageHeader
        title="Users"
        subtitle={`${profiles.length} profiles · ${profiles.length - simulated} real · ${simulated} simulated test accounts. Read-only.`}
      />
      <Card>
        <form className="mb-4 flex flex-wrap gap-2">
          <input name="q" defaultValue={params.q ?? ""} placeholder="Search name, email, category, id" className={`${inputClass} max-w-xs`} />
          <select name="who" defaultValue={who} className={`${inputClass} w-auto`}>
            <option value="all">Everyone</option>
            <option value="real">Real accounts</option>
            <option value="simulated">Simulated</option>
            <option value="admins">Superadmins</option>
          </select>
          <select name="sort" defaultValue={sort} className={`${inputClass} w-auto`}>
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>
                Sort: {v}
              </option>
            ))}
          </select>
          <button className="rounded-full bg-cocoa px-4 text-sm font-bold text-cream">Apply</button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              <tr className="border-b-2 border-zinc-100">
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3">Favorite category</th>
                <th className="py-2 pr-3 text-right">Recipes</th>
                <th className="py-2 pr-3 text-right">Ratings given</th>
                <th className="py-2 pr-3 text-right">Avg given</th>
                <th className="py-2 pr-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, recipes, ratings, avgGiven }) => (
                <tr key={p.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                  <td className="py-2 pr-3">
                    <Link href={`/users/${p.id}`} className="flex items-center gap-3">
                      <Avatar url={p.avatar_url} name={displayName(p)} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 font-bold text-cocoa">
                          {displayName(p)}
                          {p.is_superadmin && <Pill tone="cocoa">admin</Pill>}
                          {isSimulated(p) && <Pill tone="lilac">sim</Pill>}
                        </span>
                        <span className="block truncate text-xs text-zinc-500">{p.email}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-zinc-600">{p.favorite_category ?? "–"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{recipes}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{ratings}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{avgGiven != null ? `${avgGiven.toFixed(1)}★` : "–"}</td>
                  <td className="py-2 pr-3 text-zinc-600">{fmtDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="py-8 text-center text-sm text-zinc-500">No users match.</p>}
        </div>
      </Card>
    </>
  );
}
