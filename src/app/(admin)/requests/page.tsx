import Link from "next/link";
import { Card, ghostButtonClass, inputClass, PageHeader, Pager, Pill } from "@/components/admin/ui";
import { Stat, StatusPill } from "@/components/admin/stat";
import { requireAdmin } from "@/lib/admin/auth";
import { daysAgoIso, displayName, fetchAll, fmtCost, fmtDateTime, fmtMs, percentile, type GenerationRequestRow, type ProfileRow } from "@/lib/admin/data";

export const metadata = { title: "Generation requests | Recipe Remix Admin" };
export const dynamic = "force-dynamic";

const PAGE = 25;

export default async function RequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 80);
  const status = ["running", "succeeded", "failed"].includes(params.status ?? "") ? params.status! : "";
  const source = ["app", "admin"].includes(params.source ?? "") ? params.source! : "";
  const chain = params.chain && /^\d+$/.test(params.chain) ? params.chain : "";
  const page = Math.max(1, Number(params.page) || 1);

  let query = supabase
    .from("generation_requests")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (q) query = query.ilike("pantry", `%${q.replace(/[%\\]/g, " ")}%`);
  if (status) query = query.eq("status", status);
  if (source) query = query.eq("source", source);
  if (chain) query = query.eq("chain_id", Number(chain));

  const since = daysAgoIso(7);
  const [{ data, count, error }, profiles, { data: chains }, { data: week }] = await Promise.all([
    query,
    fetchAll<ProfileRow>(supabase, "profiles", "id, email, first_name, last_name, created_at"),
    supabase.from("prompt_chains").select("id, name").order("id"),
    supabase.from("generation_requests").select("status, total_latency_ms, total_cost, total_tokens").gte("created_at", since).limit(5000),
  ]);
  const rows = (data ?? []) as GenerationRequestRow[];
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status) sp.set("status", status);
    if (source) sp.set("source", source);
    if (chain) sp.set("chain", chain);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `/requests?${s}` : "/requests";
  };

  const w = (week ?? []) as Pick<GenerationRequestRow, "status" | "total_latency_ms" | "total_cost" | "total_tokens">[];
  const done = w.filter((r) => r.status !== "running");
  const okRate = done.length ? done.filter((r) => r.status === "succeeded").length / done.length : null;
  const lat = w.filter((r) => r.status === "succeeded" && r.total_latency_ms != null).map((r) => r.total_latency_ms!);
  const spend = w.reduce((a, r) => a + Number(r.total_cost ?? 0), 0);
  const tokens = w.reduce((a, r) => a + (r.total_tokens ?? 0), 0);

  return (
    <>
      <PageHeader title="📥 Generation requests" subtitle="One row per “make me a recipe” click, from the public app or this admin panel. Read-only." />
      {error && <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error.message} (has migration 0006 been run?)</p>}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Requests (7d)" value={String(w.length)} />
        <Stat label="Success rate" value={okRate == null ? "–" : `${Math.round(okRate * 100)}%`} note={`${done.length - Math.round((okRate ?? 0) * done.length)} failed`} />
        <Stat label="p50 latency" value={fmtMs(percentile(lat, 50))} note={`p95 ${fmtMs(percentile(lat, 95))}`} />
        <Stat label="Spend (7d)" value={fmtCost(spend)} />
        <Stat label="Tokens (7d)" value={tokens.toLocaleString()} />
      </div>

      <Card>
        <form className="mb-4 flex flex-wrap gap-2">
          <input name="q" defaultValue={q} placeholder="Search pantry input" className={`${inputClass} max-w-xs`} />
          <select name="status" defaultValue={status} className={`${inputClass} w-auto`}>
            <option value="">Any status</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
            <option value="running">Running</option>
          </select>
          <select name="source" defaultValue={source} className={`${inputClass} w-auto`}>
            <option value="">Any source</option>
            <option value="app">Public app</option>
            <option value="admin">Admin panel</option>
          </select>
          <select name="chain" defaultValue={chain} className={`${inputClass} w-auto`}>
            <option value="">Any chain</option>
            {(chains ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button className="rounded-full bg-cocoa px-4 text-sm font-bold text-cream">Apply</button>
          {(q || status || source || chain) && <Link href="/requests" className={ghostButtonClass}>Clear</Link>}
        </form>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              <tr className="border-b-2 border-zinc-100">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3">Pantry</th>
                <th className="py-2 pr-3">Chain</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3 text-right">Latency</th>
                <th className="py-2 pr-3 text-right">Tokens</th>
                <th className="py-2 pr-3 text-right">Cost</th>
                <th className="py-2 pr-3">Recipe</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                  <td className="py-2 pr-3"><Link href={`/requests/${r.id}`} className="font-bold text-emerald-700 hover:underline">#{r.id}</Link></td>
                  <td className="whitespace-nowrap py-2 pr-3 text-zinc-600">{fmtDateTime(r.created_at)}</td>
                  <td className="py-2 pr-3">
                    <Link href={`/users/${r.user_id}`} className="hover:underline">{displayName(byId.get(r.user_id))}</Link>
                    {r.source === "admin" && <> <Pill tone="cocoa">admin</Pill></>}
                  </td>
                  <td className="max-w-56 truncate py-2 pr-3 text-zinc-600" title={r.pantry}>{r.pantry}</td>
                  <td className="py-2 pr-3 text-zinc-600">{r.chain_id ? <Link href={`/prompt-chains/${r.chain_id}`} className="hover:underline">{r.chain_name}</Link> : r.chain_name ?? "–"}</td>
                  <td className="py-2 pr-3"><StatusPill status={r.status} />{r.error && <span className="ml-1 text-xs text-red-700" title={r.error}>⚠️</span>}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtMs(r.total_latency_ms)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.total_tokens?.toLocaleString() ?? "–"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtCost(r.total_cost)}</td>
                  <td className="py-2 pr-3">{r.recipe_id ? <Link href={`/recipes/${r.recipe_id}`} className="font-bold text-emerald-700 hover:underline">#{r.recipe_id}</Link> : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && !error && <p className="py-8 text-center text-sm text-zinc-500">No generation requests match. Generate a recipe in the app to see one here.</p>}
        </div>
        <Pager page={page} pages={pages} href={href} />
      </Card>
    </>
  );
}
