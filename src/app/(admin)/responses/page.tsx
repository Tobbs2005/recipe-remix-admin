import Link from "next/link";
import { Card, ghostButtonClass, inputClass, PageHeader, Pager, Pill } from "@/components/admin/ui";
import { Stat, StatusPill } from "@/components/admin/stat";
import { requireAdmin } from "@/lib/admin/auth";
import { fmtCost, fmtDateTime, fmtMs, percentile, type LlmResponseRow } from "@/lib/admin/data";

export const metadata = { title: "LLM responses | Recipe Remix Admin" };
export const dynamic = "force-dynamic";

const PAGE = 25;
const LIST_COLUMNS =
  "id, request_id, step_order, step_name, kind, model_id, model_name, served_model, status, http_status, error, latency_ms, prompt_tokens, completion_tokens, cost, created_at, response_text";

export default async function ResponsesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 80);
  const status = params.status === "ok" || params.status === "error" ? params.status : "";
  const kind = params.kind === "recipe_text" || params.kind === "dish_image" ? params.kind : "";
  const model = params.model && /^\d+$/.test(params.model) ? params.model : "";
  const page = Math.max(1, Number(params.page) || 1);

  let query = supabase
    .from("llm_responses")
    .select(LIST_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (q) query = query.ilike("response_text", `%${q.replace(/[%\\]/g, " ")}%`);
  if (status) query = query.eq("status", status);
  if (kind) query = query.eq("kind", kind);
  if (model) query = query.eq("model_id", Number(model));

  const [{ data, count, error }, { data: models }, { data: all }] = await Promise.all([
    query,
    supabase.from("llm_models").select("id, display_name").order("id"),
    supabase.from("llm_responses").select("model_name, served_model, status, latency_ms, cost, prompt_tokens, completion_tokens").order("created_at", { ascending: false }).limit(5000),
  ]);
  const rows = (data ?? []) as LlmResponseRow[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status) sp.set("status", status);
    if (kind) sp.set("kind", kind);
    if (model) sp.set("model", model);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `/responses?${s}` : "/responses";
  };

  // Per-model scoreboard over the latest 5000 calls.
  const perModel = new Map<string, { n: number; ok: number; lat: number[]; cost: number; tokens: number }>();
  for (const r of (all ?? []) as LlmResponseRow[]) {
    const k = r.model_name;
    const s = perModel.get(k) ?? { n: 0, ok: 0, lat: [], cost: 0, tokens: 0 };
    s.n++;
    if (r.status === "ok") s.ok++;
    if (r.latency_ms != null) s.lat.push(r.latency_ms);
    s.cost += Number(r.cost ?? 0);
    s.tokens += (r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0);
    perModel.set(k, s);
  }
  const errors = (all ?? []).filter((r) => r.status === "error").length;

  return (
    <>
      <PageHeader title="💬 LLM responses" subtitle="Every individual model call (recipe text and dish photo), with the exact prompts, raw output, latency, tokens and cost. Read-only." />
      {error && <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error.message} (has migration 0006 been run?)</p>}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Model calls" value={String(count ?? 0)} note={q || status || kind || model ? "matching filters" : "all time"} />
        <Stat label="Errors" value={String(errors)} note="latest 5000 calls" />
        <Stat label="Models used" value={String(perModel.size)} />
        <Stat label="Spend" value={fmtCost([...perModel.values()].reduce((a, s) => a + s.cost, 0))} note="latest 5000 calls" />
      </div>

      {perModel.size > 0 && (
        <Card title="By model" className="mb-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                <tr className="border-b-2 border-zinc-100">
                  <th className="py-2 pr-3">Model</th>
                  <th className="py-2 pr-3 text-right">Calls</th>
                  <th className="py-2 pr-3 text-right">OK</th>
                  <th className="py-2 pr-3 text-right">p50</th>
                  <th className="py-2 pr-3 text-right">p95</th>
                  <th className="py-2 pr-3 text-right">Tokens</th>
                  <th className="py-2 pr-3 text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {[...perModel.entries()].sort((a, b) => b[1].n - a[1].n).map(([m, s]) => (
                  <tr key={m} className="border-b border-zinc-100">
                    <td className="py-2 pr-3"><code className="font-mono text-xs">{m}</code></td>
                    <td className="py-2 pr-3 text-right tabular-nums">{s.n}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{Math.round((s.ok / s.n) * 100)}%</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmtMs(percentile(s.lat, 50))}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmtMs(percentile(s.lat, 95))}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{s.tokens.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmtCost(s.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <form className="mb-4 flex flex-wrap gap-2">
          <input name="q" defaultValue={q} placeholder="Search response text" className={`${inputClass} max-w-xs`} />
          <select name="status" defaultValue={status} className={`${inputClass} w-auto`}>
            <option value="">Any status</option>
            <option value="ok">OK</option>
            <option value="error">Error</option>
          </select>
          <select name="kind" defaultValue={kind} className={`${inputClass} w-auto`}>
            <option value="">Any step</option>
            <option value="recipe_text">Recipe text</option>
            <option value="dish_image">Dish image</option>
          </select>
          <select name="model" defaultValue={model} className={`${inputClass} w-auto`}>
            <option value="">Any model</option>
            {(models ?? []).map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
          </select>
          <button className="rounded-full bg-cocoa px-4 text-sm font-bold text-cream">Apply</button>
          {(q || status || kind || model) && <Link href="/responses" className={ghostButtonClass}>Clear</Link>}
        </form>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              <tr className="border-b-2 border-zinc-100">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Request</th>
                <th className="py-2 pr-3">Step</th>
                <th className="py-2 pr-3">Model</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Output</th>
                <th className="py-2 pr-3 text-right">Latency</th>
                <th className="py-2 pr-3 text-right">In / out</th>
                <th className="py-2 pr-3 text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100 align-top hover:bg-zinc-50">
                  <td className="py-2 pr-3"><Link href={`/responses/${r.id}`} className="font-bold text-emerald-700 hover:underline">#{r.id}</Link></td>
                  <td className="whitespace-nowrap py-2 pr-3 text-zinc-600">{fmtDateTime(r.created_at)}</td>
                  <td className="py-2 pr-3"><Link href={`/requests/${r.request_id}`} className="hover:underline">#{r.request_id}</Link></td>
                  <td className="py-2 pr-3"><Pill tone={r.kind === "recipe_text" ? "sky" : "lilac"}>{r.step_order}. {r.kind === "recipe_text" ? "text" : "image"}</Pill></td>
                  <td className="py-2 pr-3"><code className="font-mono text-xs">{r.served_model ?? r.model_name}</code></td>
                  <td className="py-2 pr-3"><StatusPill status={r.status} /></td>
                  <td className="max-w-72 py-2 pr-3"><span className="line-clamp-2 font-mono text-xs text-zinc-600">{r.error ?? r.response_text}</span></td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtMs(r.latency_ms)}</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums">{r.prompt_tokens ?? "–"} / {r.completion_tokens ?? "–"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtCost(r.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && !error && <p className="py-8 text-center text-sm text-zinc-500">No LLM responses match.</p>}
        </div>
        <Pager page={page} pages={pages} href={href} />
      </Card>
    </>
  );
}
