"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";

export type MixState = { error?: string; ok?: string };

export async function updateMix(_prev: MixState, fd: FormData): Promise<MixState> {
  const { supabase, user } = await requireAdmin();
  const rows: { chain_id: number; weight: number; updated_by: string }[] = [];
  for (const [k, v] of fd.entries()) {
    const m = k.match(/^weight_(\d+)$/);
    if (!m) continue;
    const weight = Number(v);
    if (!Number.isInteger(weight) || weight < 0 || weight > 100) return { error: "Weights must be whole numbers from 0 to 100." };
    rows.push({ chain_id: Number(m[1]), weight, updated_by: user.id });
  }
  if (!rows.length) return { error: "No chains to update." };
  if (rows.every((r) => r.weight === 0)) return { error: "At least one chain needs a weight above 0, or every recipe falls back to the built-in chain." };

  const { error } = await supabase.from("prompt_chain_mix").upsert(rows, { onConflict: "chain_id" });
  if (error) return { error: error.message };
  revalidatePath("/mix");
  revalidatePath("/prompt-chains");
  return { ok: "Mix saved. New generations use these weights immediately." };
}
