import Link from "next/link";
import { notFound } from "next/navigation";
import { StarHistogram } from "@/components/admin/charts";
import { DeleteRecipeButton, RecipeForm } from "@/components/admin/recipe-forms";
import { Avatar, Card, PageHeader, Pill, Stars } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { displayName, fetchAll, fmtDateTime, recipeImageUrl, type ProfileRow, type RecipeRow } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function RecipeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { supabase } = await requireAdmin();
  const { id: raw } = await params;
  const sp = await searchParams;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [{ data }, { data: ratingRows }, { count: saves }, profiles] = await Promise.all([
    supabase.from("recipes").select("*").eq("id", id).maybeSingle(),
    supabase.from("recipe_ratings").select("user_id, stars, created_at").eq("recipe_id", id).order("created_at", { ascending: false }),
    supabase.from("recipe_favorites").select("*", { count: "exact", head: true }).eq("recipe_id", id),
    fetchAll<ProfileRow>(supabase, "profiles", "id, email, first_name, last_name, avatar_url, created_at"),
  ]);
  if (!data) notFound();
  const r = data as RecipeRow & { system_prompt: string; user_prompt: string; raw_response: string | null };
  const ratings = (ratingRows ?? []) as { user_id: string; stars: number; created_at: string }[];
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const author = byId.get(r.user_id);
  const img = recipeImageUrl(r.image_path);

  return (
    <>
      <Link href="/recipes" className="text-sm font-bold text-emerald-700 hover:underline">
        ← All recipes
      </Link>
      <PageHeader
        title={r.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-1.5">
            <Pill>#{r.id}</Pill>
            <Pill tone="butter">{r.rating_count ? `${Number(r.avg_rating).toFixed(2)}★ from ${r.rating_count}` : "unrated"}</Pill>
            <Pill tone="pink">{saves ?? 0} saves</Pill>
            <Pill tone="sky">{r.model}</Pill>
            <span className="text-sm">
              by{" "}
              <Link href={`/users/${r.user_id}`} className="font-bold hover:underline">
                {displayName(author)}
              </Link>{" "}
              · {fmtDateTime(r.created_at)}
            </span>
          </span>
        }
      />
      {sp.created && <p className="mb-4 rounded-2xl bg-mint p-3 text-sm font-semibold text-emerald-950">Recipe created.</p>}

      <div className="grid gap-5 xl:grid-cols-5">
        <div className="space-y-5 xl:col-span-2">
          <Card>
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt={r.title} className="aspect-square w-full rounded-2xl object-cover" />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-zinc-100 text-6xl">🍲</div>
            )}
            <p className="mt-3 text-sm text-zinc-600">{r.description}</p>
          </Card>

          <Card title="Ratings" note="Read-only: users set these in Recipe Remix.">
            {ratings.length ? (
              <>
                <StarHistogram dist={[1, 2, 3, 4, 5].map((s) => ({ stars: s, n: ratings.filter((x) => x.stars === s).length }))} />
                <ul className="mt-4 divide-y divide-zinc-100">
                  {ratings.map((x) => {
                    const p = byId.get(x.user_id);
                    return (
                      <li key={x.user_id} className="flex items-center gap-2 py-2 text-sm">
                        <Avatar url={p?.avatar_url ?? null} name={displayName(p)} size="h-6 w-6" />
                        <Link href={`/users/${x.user_id}`} className="min-w-0 flex-1 truncate hover:underline">
                          {displayName(p)}
                        </Link>
                        <Stars value={x.stars} />
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="text-sm text-zinc-500">No ratings yet.</p>
            )}
          </Card>

          <Card title="Generation log" note="Exact prompts sent to the model.">
            <details className="text-sm">
              <summary className="cursor-pointer font-bold text-zinc-700">System prompt</summary>
              <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-2xl bg-zinc-50 p-3 text-xs">{r.system_prompt}</pre>
            </details>
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer font-bold text-zinc-700">User prompt</summary>
              <pre className="mt-2 whitespace-pre-wrap rounded-2xl bg-zinc-50 p-3 text-xs">{r.user_prompt}</pre>
            </details>
            {r.raw_response && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer font-bold text-zinc-700">Raw model response</summary>
                <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-2xl bg-zinc-50 p-3 text-xs">{r.raw_response}</pre>
              </details>
            )}
          </Card>
        </div>

        <div className="space-y-5 xl:col-span-3">
          <Card title="Edit recipe">
            <RecipeForm
              recipeId={r.id}
              hasImage={Boolean(r.image_path)}
              initial={{
                title: r.title,
                description: r.description,
                pantry: r.pantry,
                diet: r.diet ?? "any",
                minutes: r.minutes,
                servings: r.servings,
                ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
                steps: Array.isArray(r.steps) ? r.steps : [],
              }}
            />
          </Card>
          <Card title="Danger zone">
            <DeleteRecipeButton id={r.id} title={r.title} />
          </Card>
        </div>
      </div>
    </>
  );
}
