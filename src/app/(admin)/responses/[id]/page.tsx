import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, ghostButtonClass, PageHeader } from "@/components/admin/ui";
import { Stat, StatusPill } from "@/components/admin/stat";
import { requireAdmin } from "@/lib/admin/auth";
import { fmtCost, fmtDateTime, fmtMs, type LlmResponseRow } from "@/lib/admin/data";

export const metadata = { title: "LLM response | Recipe Remix Admin" };
export const dynamic = "force-dynamic";

function pretty(text: string | null) {
  if (!text) return "(empty)";
  try {
    const s = text.indexOf("{");
    const e = text.lastIndexOf("}");
    if (s !== -1 && e > s) return JSON.stringify(JSON.parse(text.slice(s, e + 1)), null, 2);
  } catch {}
  return text;
}

function Block({ label, text }: { label: string; text: string }) {
  return (
    <Card title={label}>
      <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-2xl bg-zinc-50 p-3 font-mono text-xs leading-relaxed text-zinc-800">{text || "(none)"}</pre>
    </Card>
  );
}

export default async function ResponsePage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const { data } = await supabase.from("llm_responses").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const r = data as LlmResponseRow;

  return (
    <>
      <PageHeader
        title={`LLM response #${r.id}`}
        subtitle={
          <>
            {fmtDateTime(r.created_at)} · step {r.step_order} ({r.step_name ?? r.kind}) of{" "}
            <Link href={`/requests/${r.request_id}`} className="font-bold text-emerald-700 hover:underline">request #{r.request_id}</Link>
          </>
        }
        action={<Link href="/responses" className={ghostButtonClass}>← Responses</Link>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Status" value={r.status} note={r.http_status ? `HTTP ${r.http_status}` : undefined} />
        <Stat label="Latency" value={fmtMs(r.latency_ms)} />
        <Stat label="Prompt tokens" value={r.prompt_tokens?.toLocaleString() ?? "–"} />
        <Stat label="Completion tokens" value={r.completion_tokens?.toLocaleString() ?? "–"} />
        <Stat label="Cost" value={fmtCost(r.cost)} />
      </div>
      <Card className="mb-4">
        <dl className="grid grid-cols-[9rem_1fr] gap-y-1 text-sm">
          <dt className="font-bold text-zinc-500">Requested model</dt>
          <dd>{r.model_id ? <Link href={`/models/${r.model_id}`} className="font-mono text-xs text-emerald-700 hover:underline">{r.model_name}</Link> : <code className="font-mono text-xs">{r.model_name}</code>}</dd>
          <dt className="font-bold text-zinc-500">Served by</dt><dd><code className="font-mono text-xs">{r.served_model ?? "–"}</code></dd>
          <dt className="font-bold text-zinc-500">Result</dt><dd><StatusPill status={r.status} /></dd>
        </dl>
        {r.error && <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{r.error}</p>}
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Block label="System prompt (as sent)" text={r.system_prompt} />
        <Block label="User prompt (as sent)" text={r.user_prompt} />
      </div>
      <div className="mt-4">
        <Block label="Raw response" text={pretty(r.response_text)} />
      </div>
    </>
  );
}
