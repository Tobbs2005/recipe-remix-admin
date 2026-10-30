import Link from "next/link";
import { Card, ghostButtonClass, PageHeader, Pill } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { CHAIN_SELECT, chainProblems, fetchAll, fmtDate, mixWeight, type ChainRow } from "@/lib/admin/data";

export const metadata = { title: "Prompt chains | Recipe Remix Admin" };
export const dynamic = "force-dynamic";

export default async function PromptChainsPage() {
  const { supabase } = await requireAdmin();
  const [{ data, error }, requests] = await Promise.all([
    supabase.from("prompt_chains").select(CHAIN_SELECT).order("id"),
    fetchAll<{ chain_id: number | null; status: string }>(supabase, "generation_requests", "chain_id, status, created_at").catch(() => []),
  ]);
  const chains = (data ?? []) as unknown as ChainRow[];
  const totalWeight = chains.filter((c) => !chainProblems(c).length).reduce((a, c) => a + mixWeight(c), 0);
  const stats = new Map<number | null, { n: number; ok: number }>();
  requests.forEach((r) => {
    const s = stats.get(r.chain_id) ?? { n: 0, ok: 0 };
    s.n++;
    if (r.status === "succeeded") s.ok++;
    stats.set(r.chain_id, s);
  });

  return (
    <>
      <PageHeader
        title="⛓️ Prompt chains"
        subtitle="Each recipe is made by one chain: a text step that writes the recipe JSON, then an image step for the dish photo. Read-only here; the share each chain gets is set on the Chain mix page."
        action={
          <Link href="/mix" className={ghostButtonClass}>
            ⚖️ Edit chain mix
          </Link>
        }
      />
      {error && <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error.message} (has migration 0006 been run?)</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {chains.map((c) => {
          const problems = chainProblems(c);
          const w = mixWeight(c);
          const share = !problems.length && totalWeight ? Math.round((w / totalWeight) * 100) : 0;
          const s = stats.get(c.id) ?? { n: 0, ok: 0 };
          const steps = [...c.prompt_chain_steps].sort((a, b) => a.step_order - b.step_order);
          return (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/prompt-chains/${c.id}`} className="text-xl font-bold text-cocoa hover:text-emerald-700 hover:underline">
                    {c.name}
                  </Link>
                  <p className="font-mono text-xs text-zinc-500">{c.slug}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold tabular-nums text-emerald-700">{share}%</p>
                  <p className="text-xs text-zinc-500">of traffic (weight {w})</p>
                </div>
              </div>
              <p className="mt-2 text-sm text-zinc-600">{c.description}</p>
              <ol className="mt-3 space-y-1.5">
                {steps.map((st) => (
                  <li key={st.id} className="flex items-center gap-2 text-sm">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cocoa text-xs font-bold text-cream">{st.step_order}</span>
                    <span className="font-semibold">{st.name}</span>
                    <Pill tone={st.kind === "recipe_text" ? "sky" : "lilac"}>{st.kind === "recipe_text" ? "text" : "image"}</Pill>
                    <span className="truncate text-xs text-zinc-500">{st.llm_models?.display_name ?? "?"}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                {problems.length ? <Pill tone="butter">⚠️ not in rotation: {problems.join(", ")}</Pill> : <Pill tone="mint">in rotation</Pill>}
                <span>
                  {s.n} requests · {s.n ? Math.round((s.ok / s.n) * 100) : 0}% succeeded · created {fmtDate(c.created_at)}
                </span>
              </div>
            </Card>
          );
        })}
      </div>
      {!chains.length && !error && <Card><p className="py-6 text-center text-sm text-zinc-500">No prompt chains yet. Run migration 0006 to seed them.</p></Card>}
    </>
  );
}
