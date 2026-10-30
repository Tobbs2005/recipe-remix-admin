import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, ghostButtonClass, PageHeader, Pill } from "@/components/admin/ui";
import { Stat, StatusPill } from "@/components/admin/stat";
import { requireAdmin } from "@/lib/admin/auth";
import { displayName, fmtCost, fmtDateTime, fmtMs, recipeImageUrl, type GenerationRequestRow, type LlmResponseRow } from "@/lib/admin/data";

export const metadata = { title: "Generation request | Recipe Remix Admin" };
export const dynamic = "force-dynamic";

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const { data } = await supabase.from("generation_requests").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const r = data as GenerationRequestRow;
  const [{ data: resp }, { data: profile }, { data: recipe }] = await Promise.all([
    supabase.from("llm_responses").select("*").eq("request_id", id).order("step_order").order("id"),
    supabase.from("profiles").select("id, email, first_name, last_name").eq("id", r.user_id).maybeSingle(),
    r.recipe_id ? supabase.from("recipes").select("id, title, image_path").eq("id", r.recipe_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const responses = (resp ?? []) as LlmResponseRow[];
  const img = recipe ? recipeImageUrl(recipe.image_path) : null;

  return (
    <>
      <PageHeader
        title={`Request #${r.id}`}
        subtitle={<>{fmtDateTime(r.created_at)} · by <Link href={`/users/${r.user_id}`} className="font-bold hover:underline">{displayName(profile)}</Link> from the {r.source === "admin" ? "admin panel" : "public app"}</>}
        action={<Link href="/requests" className={ghostButtonClass}>← Requests</Link>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Status" value={r.status} />
        <Stat label="Total latency" value={fmtMs(r.total_latency_ms)} />
        <Stat label="Tokens" value={r.total_tokens?.toLocaleString() ?? "–"} />
        <Stat label="Cost" value={fmtCost(r.total_cost)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card title="Input">
            <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
              <dt className="font-bold text-zinc-500">Pantry</dt><dd>{r.pantry}</dd>
              <dt className="font-bold text-zinc-500">Diet</dt><dd>{r.diet ?? "–"}</dd>
              <dt className="font-bold text-zinc-500">Chain</dt>
              <dd>{r.chain_id ? <Link href={`/prompt-chains/${r.chain_id}`} className="font-bold text-emerald-700 hover:underline">{r.chain_name}</Link> : r.chain_name ?? "–"}</dd>
              <dt className="font-bold text-zinc-500">Finished</dt><dd>{r.finished_at ? fmtDateTime(r.finished_at) : "still running (or crashed)"}</dd>
            </dl>
            {r.error && <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{r.error}</p>}
          </Card>
          <h2 className="text-xl font-bold text-cocoa">LLM responses ({responses.length})</h2>
          {responses.map((x) => (
            <Card key={x.id}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cocoa text-sm font-bold text-cream">{x.step_order}</span>
                <Link href={`/responses/${x.id}`} className="font-bold text-cocoa hover:text-emerald-700 hover:underline">{x.step_name ?? x.kind}</Link>
                <StatusPill status={x.status} />
                <code className="font-mono text-xs text-zinc-500">{x.served_model ?? x.model_name}</code>
                <span className="ml-auto text-xs tabular-nums text-zinc-500">
                  {fmtMs(x.latency_ms)} · {x.prompt_tokens ?? "–"} in / {x.completion_tokens ?? "–"} out · {fmtCost(x.cost)}
                </span>
              </div>
              {x.error && <p className="mb-2 rounded-2xl bg-red-50 p-2 text-xs font-semibold text-red-700">HTTP {x.http_status ?? "–"}: {x.error}</p>}
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-2xl bg-zinc-50 p-3 font-mono text-xs text-zinc-800">{x.response_text || "(empty)"}</pre>
              <Link href={`/responses/${x.id}`} className="mt-2 inline-block text-xs font-bold text-emerald-700 hover:underline">See full prompts →</Link>
            </Card>
          ))}
          {!responses.length && <Card><p className="text-sm text-zinc-500">No model calls were logged for this request.</p></Card>}
        </div>
        <Card title="Result">
          {recipe ? (
            <Link href={`/recipes/${recipe.id}`} className="block">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt="" className="aspect-square w-full rounded-2xl object-cover" />
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-2xl bg-zinc-100 text-sm text-zinc-500">No photo</div>
              )}
              <p className="mt-2 font-bold text-cocoa hover:underline">{recipe.title}</p>
              <Pill tone="mint">recipe #{recipe.id}</Pill>
            </Link>
          ) : (
            <p className="text-sm text-zinc-500">{r.recipe_id ? `Recipe #${r.recipe_id} was deleted.` : "No recipe was saved."}</p>
          )}
        </Card>
      </div>
    </>
  );
}
