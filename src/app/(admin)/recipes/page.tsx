import Link from "next/link";
import { Card, inputClass, PageHeader, Pager, Pill, buttonClass } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { displayName, fetchAll, fmtDate, recipeImageUrl, RECIPE_LIST_COLUMNS, type ProfileRow, type RecipeRow } from "@/lib/admin/data";
import { DIETS, isDiet } from "@/lib/diets";

export const metadata = { title: "AI recipes | Recipe Remix Admin" };
export const dynamic = "force-dynamic";

const PAGE = 24;
const SORTS = {
  newest: { label: "Newest", col: "created_at", asc: false },
  oldest: { label: "Oldest", col: "created_at", asc: true },
  top: { label: "Highest rated", col: "avg_rating", asc: false },
  most: { label: "Most ratings", col: "rating_count", asc: false },
} as const;
type Sort = keyof typeof SORTS;

export default async function RecipesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 80);
  const diet = params.diet && isDiet(params.diet) ? params.diet : "";
  const photo = params.photo === "yes" || params.photo === "no" ? params.photo : "";
  const sort: Sort = params.sort && params.sort in SORTS ? (params.sort as Sort) : "newest";
  const page = Math.max(1, Number(params.page) || 1);

  let query = supabase
    .from("recipes")
    .select(RECIPE_LIST_COLUMNS, { count: "exact" })
    .order(SORTS[sort].col, { ascending: SORTS[sort].asc })
    .order("id", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (q) {
    const safe = q.replace(/[%,()*\\]/g, " ");
    query = query.or(`title.ilike.%${safe}%,pantry.ilike.%${safe}%,description.ilike.%${safe}%`);
  }
  if (diet) query = query.eq("diet", diet);
  if (photo === "yes") query = query.not("image_path", "is", null);
  if (photo === "no") query = query.is("image_path", null);

  const [{ data, count, error }, profiles] = await Promise.all([
    query,
    fetchAll<ProfileRow>(supabase, "profiles", "id, email, first_name, last_name, created_at"),
  ]);
  const recipes = (data ?? []) as unknown as RecipeRow[];
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (diet) sp.set("diet", diet);
    if (photo) sp.set("photo", photo);
    if (sort !== "newest") sp.set("sort", sort);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `/recipes?${s}` : "/recipes";
  };

  return (
    <>
      <PageHeader
        title="AI recipes"
        subtitle="Every AI-generated recipe and dish photo. Create, edit or delete them here."
        action={
          <Link href="/recipes/new" className={buttonClass}>
            + New recipe
          </Link>
        }
      />
      {params.deleted && <p className="mb-4 rounded-2xl bg-mint p-3 text-sm font-semibold text-emerald-950">Recipe deleted.</p>}
      <Card>
        <form className="mb-5 flex flex-wrap gap-2">
          <input name="q" defaultValue={q} placeholder="Search title, pantry, description" className={`${inputClass} max-w-xs`} />
          <select name="diet" defaultValue={diet} className={`${inputClass} w-auto`}>
            <option value="">All diets</option>
            {Object.entries(DIETS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.split(" (")[0]}
              </option>
            ))}
          </select>
          <select name="photo" defaultValue={photo} className={`${inputClass} w-auto`}>
            <option value="">Any photo</option>
            <option value="yes">Has photo</option>
            <option value="no">Missing photo</option>
          </select>
          <select name="sort" defaultValue={sort} className={`${inputClass} w-auto`}>
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>
                Sort: {v.label}
              </option>
            ))}
          </select>
          <button className="rounded-full bg-cocoa px-4 text-sm font-bold text-cream">Apply</button>
          <span className="ml-auto self-center text-sm text-zinc-500">{count ?? 0} recipes</span>
        </form>
        {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}

        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {recipes.map((r) => {
            const img = recipeImageUrl(r.image_path);
            return (
              <li key={r.id}>
                <Link
                  href={`/recipes/${r.id}`}
                  className="group flex h-full gap-3 rounded-3xl border-2 border-zinc-100 p-2.5 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-soft"
                >
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="" className="h-24 w-24 shrink-0 rounded-2xl object-cover" />
                  ) : (
                    <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-3xl" title="No photo">
                      🍲
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="line-clamp-2 font-bold leading-snug text-cocoa group-hover:text-emerald-700">{r.title}</span>
                      <span className="shrink-0 text-xs text-zinc-400">#{r.id}</span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-zinc-500">by {displayName(byId.get(r.user_id))}</span>
                    <span className="mt-2 flex flex-wrap gap-1">
                      <Pill tone="butter">{r.rating_count ? `${Number(r.avg_rating).toFixed(1)}★ · ${r.rating_count}` : "unrated"}</Pill>
                      {r.diet && r.diet !== "any" && <Pill tone="mint">{r.diet}</Pill>}
                      {r.model === "admin/manual" && <Pill tone="lilac">manual</Pill>}
                      <Pill>{fmtDate(r.created_at)}</Pill>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {recipes.length === 0 && <p className="py-8 text-center text-sm text-zinc-500">No recipes match.</p>}
        <Pager page={page} pages={pages} href={href} />
      </Card>
    </>
  );
}
