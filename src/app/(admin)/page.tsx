import Link from "next/link";
import { DailyActivity, Empty, HBars, KitchenClock, StarHistogram, StatTile } from "@/components/admin/charts";
import { Avatar, Card, PageHeader, Pill, Stars } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import {
  displayName,
  fetchAll,
  recipeImageUrl,
  RECIPE_LIST_COLUMNS,
  type FavoriteRow,
  type ProfileRow,
  type RatingRow,
  type RecipeRow,
} from "@/lib/admin/data";
import { computeStats, DOWS } from "@/lib/admin/stats";
import { DIETS, DIET_STYLE, ingredientEmoji, isDiet } from "@/lib/diets";

export const metadata = { title: "Overview | Recipe Remix Admin" };
export const dynamic = "force-dynamic";

const hour12 = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;

export default async function OverviewPage() {
  const { supabase } = await requireAdmin();
  const [profiles, recipes, ratings, favorites] = await Promise.all([
    fetchAll<ProfileRow>(supabase, "profiles", "*"),
    fetchAll<RecipeRow>(supabase, "recipes", RECIPE_LIST_COLUMNS),
    fetchAll<RatingRow>(supabase, "recipe_ratings", "*"),
    fetchAll<FavoriteRow>(supabase, "recipe_favorites", "*"),
  ]);
  const s = computeStats({ profiles, recipes, ratings, favorites });
  const t = s.totals;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "0%");

  return (
    <>
      <PageHeader
        title="Kitchen report"
        subtitle={
          <>
            Live from the Recipe Remix database: {t.users} cooks, {t.recipes} AI recipes, {t.ratings} ratings.
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile emoji="🧑‍🍳" label="Users" value={t.users} hint={`${t.activeCooks} have cooked · ${t.admins} admin${t.admins === 1 ? "" : "s"}`} />
        <StatTile emoji="🍲" label="AI recipes" value={t.recipes} hint={`${(t.recipes / Math.max(1, t.activeCooks)).toFixed(1)} per active cook`} />
        <StatTile emoji="⭐" label="Ratings" value={t.ratings} hint={`from ${t.activeRaters} raters`} />
        <StatTile emoji="📈" label="Avg stars" value={t.avgStars ? t.avgStars.toFixed(2) : "–"} hint={<Stars value={t.avgStars} size="text-xs" />} />
        <StatTile emoji="📸" label="Photo hit rate" value={pct(t.withPhoto, t.recipes)} hint={`${t.recipes - t.withPhoto} recipes have no image`} />
        <StatTile emoji="👻" label="Never rated" value={pct(t.unrated, t.recipes)} hint={`${t.unrated} lonely recipes`} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-5">
        <Card
          className="xl:col-span-3"
          title="Kitchen clock"
          note={
            s.peak.n ? (
              <>
                When people cook and rate (ET). Rush hour is <b>{DOWS[s.peak.dow]} around {hour12(s.peak.hour)}</b> with {s.peak.n} actions.
              </>
            ) : (
              "When people cook and rate (ET)."
            )
          }
        >
          <KitchenClock clock={s.clock} />
        </Card>
        <Card className="xl:col-span-2" title="Last 30 days" note="New recipes and ratings per day. Hover a bar for the count.">
          <DailyActivity days={s.days} />
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Card
          title="What's in everyone's fridge"
          note={
            s.ingredientMvp ? (
              <>
                Most listed pantry items, with the avg stars their recipes earn. MVP: <b>{ingredientEmoji(s.ingredientMvp.item)} {s.ingredientMvp.item}</b> ({s.ingredientMvp.avg.toFixed(2)}★).
              </>
            ) : (
              "Most listed pantry items, with the avg stars their recipes earn."
            )
          }
        >
          <HBars
            rows={s.topIngredients.map((i) => ({
              label: (
                <>
                  {ingredientEmoji(i.item)} {i.item}
                </>
              ),
              value: i.n,
              note: i.avg != null ? `${i.avg.toFixed(1)}★` : "–",
              tip: `${i.item}: in ${i.n} recipes${i.avg != null ? `, avg ${i.avg.toFixed(2)} stars` : ", not rated yet"}`,
            }))}
          />
        </Card>

        <Card title="How generous are raters?" note={`Every rating ever given. ${pct(s.starDist[4].n, t.ratings)} are perfect 5s.`}>
          {t.ratings ? <StarHistogram dist={s.starDist} /> : <Empty />}
          {t.selfRatings > 0 && (
            <p className="mt-4 rounded-2xl bg-butter/60 p-3 text-xs font-semibold text-amber-900">
              🙈 {t.selfRatings} rating{t.selfRatings === 1 ? " was" : "s were"} people rating their own recipe (avg {t.selfRatingAvg.toFixed(1)}★).
            </p>
          )}
        </Card>

        <Card title="Does faster cook better?" note="Average stars by the AI's estimated cook time.">
          <HBars
            color="bg-mint-deep"
            rows={s.buckets.map((b) => ({
              label: b.label,
              value: b.recipes,
              note: b.avg != null ? `${b.avg.toFixed(2)}★` : "–",
              tip: `${b.label}: ${b.recipes} recipes${b.avg != null ? `, avg ${b.avg.toFixed(2)} stars` : ""}`,
            }))}
          />
          <p className="mt-3 text-xs text-zinc-500">Bar = number of recipes · right = avg stars</p>
        </Card>

        <Card title="Diet split" note="Which dietary preference cooks ask for, and how those recipes rate.">
          <HBars
            color="bg-lilac-deep"
            rows={s.diets.map((d) => ({
              label: (
                <>
                  {isDiet(d.diet) ? DIET_STYLE[d.diet].emoji : "🍽️"} {isDiet(d.diet) ? DIETS[d.diet].split(" (")[0] : d.diet}
                </>
              ),
              value: d.n,
              note: d.avg != null ? `${d.avg.toFixed(2)}★` : "–",
            }))}
          />
        </Card>

        <Card title="Critics corner" note="Raters with 3+ ratings, by the average stars they hand out.">
          {s.harshest.length ? (
            <div className="grid grid-cols-2 gap-4">
              <CriticList title="🧂 Toughest" people={s.harshest} />
              <CriticList title="🍯 Sweetest" people={s.sweetest} />
            </div>
          ) : (
            <Empty>Nobody has rated 3+ recipes yet.</Empty>
          )}
        </Card>

        <Card title="Top chefs" note="Most recipes generated, and how they're received.">
          <ul className="space-y-2">
            {s.topChefs.map((c) => (
              <li key={c.id}>
                <Link href={`/users/${c.id}`} className="flex items-center gap-3 rounded-2xl p-1.5 hover:bg-zinc-50">
                  <Avatar url={c.profile?.avatar_url ?? null} name={displayName(c.profile)} />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{displayName(c.profile)}</span>
                  <span className="text-sm tabular-nums text-zinc-600">{c.n} recipes</span>
                  <span className="w-12 text-right text-sm tabular-nums text-zinc-500">{c.avg != null ? `${c.avg.toFixed(1)}★` : "–"}</span>
                </Link>
              </li>
            ))}
            {s.topChefs.length === 0 && <Empty />}
          </ul>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card title="🏆 Hall of fame" note="Highest average with at least 2 ratings.">
          <RecipeList items={s.hallOfFame.map((r) => ({ r, right: `${Number(r.avg_rating).toFixed(2)}★ · ${r.rating_count}` }))} />
        </Card>
        <Card title="🌶️ Most divisive" note="Biggest disagreement between raters (std. dev. of stars, 3+ ratings).">
          <RecipeList
            items={s.divisive.map((d) => ({
              r: d.recipe!,
              right: `±${d.spread.toFixed(2)}`,
              sub: [...d.stars].sort().join(" "),
            }))}
          />
        </Card>
        <Card title="❤️ Most saved" note="Recipes people hearted into their kitchen.">
          <RecipeList items={s.mostSaved.map((d) => ({ r: d.recipe!, right: `${d.n} saves` }))} />
          {s.models.length > 0 && (
            <div className="mt-5 border-t-2 border-dashed border-zinc-200 pt-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Text models used</p>
              <div className="flex flex-wrap gap-1.5">
                {s.models.map((m) => (
                  <Pill key={m.model} tone="sky">
                    {m.model} · {m.n}
                  </Pill>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function CriticList({ title, people }: { title: string; people: { id: string; profile: ProfileRow | null; avg: number; n: number }[] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-bold">{title}</p>
      <ul className="space-y-2">
        {people.map((p) => (
          <li key={p.id}>
            <Link href={`/users/${p.id}`} className="flex items-center gap-2 rounded-xl hover:bg-zinc-50" title={`${p.n} ratings`}>
              <Avatar url={p.profile?.avatar_url ?? null} name={displayName(p.profile)} size="h-7 w-7" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{displayName(p.profile)}</span>
                <span className="block text-xs tabular-nums text-zinc-500">
                  {p.avg.toFixed(2)}★ avg · {p.n}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecipeList({ items }: { items: { r: RecipeRow; right: string; sub?: string }[] }) {
  if (items.length === 0) return <Empty />;
  return (
    <ul className="space-y-2">
      {items.map(({ r, right, sub }) => {
        const img = recipeImageUrl(r.image_path);
        return (
          <li key={r.id}>
            <Link href={`/recipes/${r.id}`} className="flex items-center gap-3 rounded-2xl p-1.5 hover:bg-zinc-50">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
              ) : (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100">🍲</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{r.title}</span>
                {sub && <span className="block text-xs text-zinc-500">stars: {sub}</span>}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-600">{right}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
