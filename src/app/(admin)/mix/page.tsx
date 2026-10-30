import { Card, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { CHAIN_SELECT, chainProblems, fetchAll, fmtDateTime, mixWeight, type ChainRow } from "@/lib/admin/data";
import { MixForm } from "./mix-form";

export const metadata = { title: "Chain mix | Recipe Remix Admin" };
export const dynamic = "force-dynamic";

export default async function MixPage() {
  const { supabase } = await requireAdmin();
  const [{ data, error }, requests] = await Promise.all([
    supabase.from("prompt_chains").select(CHAIN_SELECT).order("id"),
    fetchAll<{ chain_id: number | null; status: string }>(supabase, "generation_requests", "chain_id, status, created_at").catch(() => []),
  ]);
  const chains = (data ?? []) as unknown as ChainRow[];
  const lastUpdate = chains
    .map((c) => (Array.isArray(c.prompt_chain_mix) ? c.prompt_chain_mix[0] : c.prompt_chain_mix)?.updated_at)
    .filter(Boolean)
    .sort()
    .pop();

  const rows = chains.map((c) => {
    const mine = requests.filter((r) => r.chain_id === c.id);
    return {
      id: c.id,
      name: c.name,
      weight: mixWeight(c),
      problems: chainProblems(c),
      requests: mine.length,
      okRate: mine.length ? mine.filter((r) => r.status === "succeeded").length / mine.length : null,
    };
  });

  return (
    <>
      <PageHeader
        title="⚖️ Prompt chain mix"
        subtitle={`Every new recipe picks one chain at random, weighted by these numbers (0 to 100). Shares are relative, so 70/30 and 7/3 behave the same.${lastUpdate ? ` Last changed ${fmtDateTime(lastUpdate)}.` : ""}`}
      />
      {error && <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error.message} (has migration 0006 been run?)</p>}
      <Card className="max-w-3xl">
        {rows.length ? <MixForm chains={rows} /> : <p className="text-sm text-zinc-500">No prompt chains yet.</p>}
      </Card>
    </>
  );
}
