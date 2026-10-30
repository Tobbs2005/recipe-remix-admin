import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, ghostButtonClass, PageHeader, Pill } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { CHAIN_SELECT, chainProblems, fmtCost, fmtDateTime, fmtMs, mixWeight, type ChainRow, type GenerationRequestRow } from "@/lib/admin/data";

export const metadata = { title: "Prompt chain | Recipe Remix Admin" };
export const dynamic = "force-dynamic";

function Prompt({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</p>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl bg-zinc-50 p-3 font-mono text-xs leading-relaxed text-zinc-800">
        {text || <span className="text-zinc-400">(none)</span>}
      </pre>
    </div>
  );
}

export default async function PromptChainPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [{ data }, { data: recent }] = await Promise.all([
    supabase.from("prompt_chains").select(CHAIN_SELECT).eq("id", id).maybeSingle(),
    supabase.from("generation_requests").select("*").eq("chain_id", id).order("created_at", { ascending: false }).limit(10),
  ]);
  if (!data) notFound();
  const chain = data as unknown as ChainRow;
  const steps = [...chain.prompt_chain_steps].sort((a, b) => a.step_order - b.step_order);
  const problems = chainProblems(chain);
  const reqs = (recent ?? []) as GenerationRequestRow[];

  return (
    <>
      <PageHeader
        title={chain.name}
        subtitle={
          <>
            <code className="font-mono text-xs">{chain.slug}</code> · mix weight {mixWeight(chain)} · {chain.is_active ? "active" : "inactive"} · updated {fmtDateTime(chain.updated_at)}
          </>
        }
        action={
          <div className="flex gap-2">
            <Link href="/prompt-chains" className={ghostButtonClass}>← Chains</Link>
            <Link href="/mix" className={ghostButtonClass}>⚖️ Mix</Link>
          </div>
        }
      />
      <p className="mb-4 text-zinc-600">{chain.description}</p>
      {problems.length > 0 && (
        <p className="mb-4 rounded-2xl bg-butter p-3 text-sm font-semibold text-amber-900">Not receiving traffic: {problems.join(", ")}.</p>
      )}

      <h2 className="mb-3 text-xl font-bold text-cocoa">Prompt chain steps</h2>
      <div className="space-y-4">
        {steps.map((s) => (
          <Card key={s.id}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cocoa text-sm font-bold text-cream">{s.step_order}</span>
              <h3 className="text-lg font-semibold text-cocoa">{s.name}</h3>
              <Pill tone={s.kind === "recipe_text" ? "sky" : "lilac"}>{s.kind}</Pill>
              <Link href={`/models/${s.model_id}`} className="text-sm font-bold text-emerald-700 hover:underline">
                {s.llm_models?.display_name} <code className="font-mono text-xs text-zinc-500">{s.llm_models?.model_id}</code>
              </Link>
              {s.llm_models && !s.llm_models.is_active && <Pill tone="butter">model off</Pill>}
              <span className="ml-auto text-xs text-zinc-500">step #{s.id} · updated {fmtDateTime(s.updated_at)}</span>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <Prompt label="System prompt" text={s.system_prompt} />
              <Prompt label="User prompt template" text={s.user_prompt_template} />
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Placeholders: <code>{"{{pantry}}"}</code> <code>{"{{diet}}"}</code> <code>{"{{title}}"}</code> <code>{"{{image_prompt}}"}</code> <code>{"{{terms}}"}</code> (from Terms) <code>{"{{examples}}"}</code> (from Generation examples).
      </p>

      <Card title="Recent requests through this chain" className="mt-6">
        {reqs.length ? (
          <ul className="divide-y divide-zinc-100 text-sm">
            {reqs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-2">
                <Link href={`/requests/${r.id}`} className="font-bold text-emerald-700 hover:underline">#{r.id}</Link>
                <Pill tone={r.status === "succeeded" ? "mint" : r.status === "failed" ? "red" : "butter"}>{r.status}</Pill>
                <span className="min-w-0 flex-1 truncate text-zinc-600">{r.pantry}</span>
                <span className="text-xs tabular-nums text-zinc-500">{fmtMs(r.total_latency_ms)} · {fmtCost(r.total_cost)} · {fmtDateTime(r.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">No requests yet.</p>
        )}
      </Card>
    </>
  );
}
