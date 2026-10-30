import Link from "next/link";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin/auth";
import { fmtDateTime } from "@/lib/admin/data";
import { getResource, type Column, type Resource } from "@/lib/admin/resources";
import { CrudDeleteButton, CrudForm, CrudToggle, type RefOptions } from "./crud-form";
import { buttonClass, Card, ghostButtonClass, inputClass, PageHeader, Pager, Pill } from "./ui";

const PAGE = 25;
type Params = Promise<Record<string, string | undefined>>;

async function loadRefOptions(supabase: SupabaseClient, res: Resource): Promise<RefOptions> {
  const out: RefOptions = {};
  await Promise.all(
    res.fields
      .filter((f) => f.type === "ref" && f.ref)
      .map(async (f) => {
        const { data } = await supabase.from(f.ref!.table).select(`id, ${f.ref!.label}`).order("id");
        out[f.name] = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({ value: String(r.id), label: String(r[f.ref!.label]) }));
      })
  );
  return out;
}

async function loadRefLabels(supabase: SupabaseClient, cols: Column[]) {
  const maps: Record<string, Map<number, string>> = {};
  await Promise.all(
    cols
      .filter((c) => c.kind === "ref" && c.ref)
      .map(async (c) => {
        const { data } = await supabase.from(c.ref!.table).select(`id, ${c.ref!.label}`);
        maps[c.name] = new Map(((data ?? []) as unknown as Record<string, unknown>[]).map((r) => [Number(r.id), String(r[c.ref!.label])]));
      })
  );
  return maps;
}

function Cell({ res, col, row, refs }: { res: Resource; col: Column; row: Record<string, unknown>; refs: Record<string, Map<number, string>> }) {
  const v = row[col.name];
  if (col.kind === "bool") return <CrudToggle resourceKey={res.key} id={Number(row.id)} column={col.name} value={Boolean(v)} />;
  if (v == null || v === "") return <span className="text-zinc-400">–</span>;
  if (col.kind === "date") return <span className="whitespace-nowrap text-zinc-600">{fmtDateTime(String(v))}</span>;
  if (col.kind === "ref") return <span>{refs[col.name]?.get(Number(v)) ?? `#${v}`}</span>;
  if (col.kind === "mono") return <code className="font-mono text-xs">{String(v)}</code>;
  if (col.kind === "money") return <span className="tabular-nums">${Number(v).toFixed(2)}</span>;
  if (col.kind === "truncate") return <span className="line-clamp-2 max-w-md text-zinc-600">{String(v)}</span>;
  return <span>{String(v)}</span>;
}

export async function ResourceListPage({ resourceKey, searchParams }: { resourceKey: string; searchParams: Params }) {
  const { supabase } = await requireAdmin();
  const res = getResource(resourceKey);
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number(params.page) || 1);

  let query = supabase
    .from(res.table)
    .select("*", { count: "exact" })
    .order(res.orderBy, { ascending: res.asc ?? false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (q) {
    const safe = q.replace(/[%,()*\\]/g, " ");
    query = query.or(res.search.map((c) => `${c}.ilike.%${safe}%`).join(","));
  }
  const [{ data, count, error }, refs] = await Promise.all([query, loadRefLabels(supabase, res.columns)]);
  const rows = (data ?? []) as Record<string, unknown>[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `/${res.key}?${s}` : `/${res.key}`;
  };
  const labelCol = res.columns[0].name;

  return (
    <>
      <PageHeader
        title={`${res.icon} ${res.title}`}
        subtitle={`${count ?? 0} total. ${res.description}`}
        action={
          <Link href={`/${res.key}/new`} className={buttonClass}>
            + New {res.singular}
          </Link>
        }
      />
      {params.created && <p className="mb-4 rounded-2xl bg-mint p-3 text-sm font-semibold text-emerald-950">Created {res.singular} #{params.created}.</p>}
      {params.deleted && <p className="mb-4 rounded-2xl bg-butter p-3 text-sm font-semibold text-amber-900">Deleted.</p>}
      {error && <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error.message} (has migration 0006 been run?)</p>}
      <Card>
        <form className="mb-4 flex flex-wrap gap-2">
          <input name="q" defaultValue={q} placeholder={`Search ${res.search.join(", ")}`} className={`${inputClass} max-w-xs`} />
          <button className="rounded-full bg-cocoa px-4 text-sm font-bold text-cream">Search</button>
          {q && (
            <Link href={`/${res.key}`} className={ghostButtonClass}>
              Clear
            </Link>
          )}
        </form>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              <tr className="border-b-2 border-zinc-100">
                <th className="py-2 pr-3">#</th>
                {res.columns.map((c) => (
                  <th key={c.name} className="py-2 pr-3">
                    {c.label}
                  </th>
                ))}
                <th className="py-2 pr-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.id)} className="border-b border-zinc-100 align-top hover:bg-zinc-50">
                  <td className="py-2 pr-3 tabular-nums text-zinc-400">{String(row.id)}</td>
                  {res.columns.map((c) => (
                    <td key={c.name} className={`py-2 pr-3 ${c.name === labelCol ? "font-bold text-cocoa" : ""}`}>
                      {c.name === labelCol ? (
                        <Link href={`/${res.key}/${row.id}`} className="hover:text-emerald-700 hover:underline">
                          <Cell res={res} col={c} row={row} refs={refs} />
                        </Link>
                      ) : (
                        <Cell res={res} col={c} row={row} refs={refs} />
                      )}
                    </td>
                  ))}
                  <td className="py-2 pr-3 text-right">
                    <Link href={`/${res.key}/${row.id}`} className="text-xs font-bold text-emerald-700 hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && !error && (
            <p className="py-8 text-center text-sm text-zinc-500">
              {q ? "Nothing matches that search." : `No ${res.title.toLowerCase()} yet.`}{" "}
              <Link href={`/${res.key}/new`} className="font-bold text-emerald-700 hover:underline">
                Add one
              </Link>
            </p>
          )}
        </div>
        <Pager page={page} pages={pages} href={href} />
      </Card>
    </>
  );
}

export async function ResourceNewPage({ resourceKey }: { resourceKey: string }) {
  const { supabase } = await requireAdmin();
  const res = getResource(resourceKey);
  const refOptions = await loadRefOptions(supabase, res);
  return (
    <>
      <PageHeader
        title={`New ${res.singular}`}
        subtitle={res.description}
        action={
          <Link href={`/${res.key}`} className={ghostButtonClass}>
            ← {res.title}
          </Link>
        }
      />
      <Card className="max-w-2xl">
        <CrudForm resourceKey={res.key} singular={res.singular} fields={res.fields} refOptions={refOptions} />
      </Card>
    </>
  );
}

export async function ResourceEditPage({ resourceKey, params }: { resourceKey: string; params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdmin();
  const res = getResource(resourceKey);
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [{ data: row }, refOptions] = await Promise.all([
    supabase.from(res.table).select("*").eq("id", id).maybeSingle(),
    loadRefOptions(supabase, res),
  ]);
  if (!row) notFound();
  const label = String(row[res.columns[0].name] ?? `#${id}`);

  return (
    <>
      <PageHeader
        title={label}
        subtitle={
          <>
            {res.title} #{id}
            {row.created_at && <> · created {fmtDateTime(row.created_at)}</>}
            {row.updated_at && <> · updated {fmtDateTime(row.updated_at)}</>}
          </>
        }
        action={
          <Link href={`/${res.key}`} className={ghostButtonClass}>
            ← {res.title}
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title={`Edit ${res.singular}`}>
          <CrudForm resourceKey={res.key} singular={res.singular} id={id} fields={res.fields} initial={row} refOptions={refOptions} />
        </Card>
        <Card title="Danger zone">
          <CrudDeleteButton resourceKey={res.key} id={id} label={label} note={res.deleteNote} />
          {"is_active" in row && (
            <p className="mt-3 text-xs text-zinc-500">
              Status: {row.is_active ? <Pill tone="mint">active</Pill> : <Pill>inactive</Pill>}
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
