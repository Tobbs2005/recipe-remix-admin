"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { explainDbError, getResource, parseResourceForm } from "@/lib/admin/resources";

export type CrudState = { error?: string; ok?: string };

/** Create (id = null) or update one row of a configured resource. */
export async function saveResource(key: string, id: number | null, _prev: CrudState, fd: FormData): Promise<CrudState> {
  const { supabase } = await requireAdmin();
  const res = getResource(key);
  const row = parseResourceForm(res, fd);
  if (typeof row === "string") return { error: row };

  if (id == null) {
    const { data, error } = await supabase.from(res.table).insert(row).select("id").single();
    if (error || !data) return { error: error ? explainDbError(res, error) : "Insert was blocked." };
    revalidatePath(`/${key}`);
    redirect(`/${key}?created=${data.id}`);
  }

  const { error, count } = await supabase.from(res.table).update(row, { count: "exact" }).eq("id", id);
  if (error) return { error: explainDbError(res, error) };
  if (!count) return { error: "Nothing was updated (row missing or permission denied)." };
  revalidatePath(`/${key}`);
  revalidatePath(`/${key}/${id}`);
  return { ok: "Saved." };
}

export async function deleteResource(key: string, id: number): Promise<CrudState> {
  const { supabase } = await requireAdmin();
  const res = getResource(key);
  const { error, count } = await supabase.from(res.table).delete({ count: "exact" }).eq("id", id);
  if (error) return { error: explainDbError(res, error) };
  if (!count) return { error: "Delete was blocked (row missing or permission denied)." };
  revalidatePath(`/${key}`);
  redirect(`/${key}?deleted=1`);
}

/** Quick on/off toggle from the list view (is_active / include_in_prompt). */
export async function toggleResource(key: string, id: number, column: string, value: boolean): Promise<CrudState> {
  const { supabase } = await requireAdmin();
  const res = getResource(key);
  if (!res.fields.some((f) => f.name === column && f.type === "checkbox")) return { error: "Not a toggle." };
  const { error } = await supabase.from(res.table).update({ [column]: value }).eq("id", id);
  if (error) return { error: explainDbError(res, error) };
  revalidatePath(`/${key}`);
  return { ok: "Saved." };
}
