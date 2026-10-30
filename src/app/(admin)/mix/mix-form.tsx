"use client";

import { useActionState, useState } from "react";
import { buttonClass, inputClass } from "@/components/admin/ui";
import { updateMix, type MixState } from "./actions";

type Row = { id: number; name: string; weight: number; problems: string[]; requests: number; okRate: number | null };

export function MixForm({ chains }: { chains: Row[] }) {
  const [state, action, pending] = useActionState<MixState, FormData>(updateMix, {});
  const [weights, setWeights] = useState(() => Object.fromEntries(chains.map((c) => [c.id, c.weight])) as Record<number, number>);
  const live = chains.filter((c) => !c.problems.length);
  const total = live.reduce((a, c) => a + (weights[c.id] || 0), 0);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-3">
        {chains.map((c) => {
          const share = !c.problems.length && total ? ((weights[c.id] || 0) / total) * 100 : 0;
          return (
            <div key={c.id} className="rounded-3xl border-2 border-zinc-100 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="min-w-40 flex-1 font-bold text-cocoa">{c.name}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={weights[c.id] ?? 0}
                  onChange={(e) => setWeights({ ...weights, [c.id]: Number(e.target.value) })}
                  className="w-40 accent-emerald-600"
                  aria-label={`${c.name} weight slider`}
                />
                <input
                  name={`weight_${c.id}`}
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={weights[c.id] ?? 0}
                  onChange={(e) => setWeights({ ...weights, [c.id]: Number(e.target.value) })}
                  className={`${inputClass} w-20 text-right tabular-nums`}
                  aria-label={`${c.name} weight`}
                />
                <span className="w-16 text-right text-lg font-bold tabular-nums text-emerald-700">{Math.round(share)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${share}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-zinc-500">
                {c.requests} requests so far{c.okRate != null && ` · ${Math.round(c.okRate * 100)}% succeeded`}
                {c.problems.length > 0 && <span className="font-semibold text-amber-700"> · gets 0% until fixed: {c.problems.join(", ")}</span>}
              </p>
            </div>
          );
        })}
      </div>
      {state.error && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-2xl bg-mint p-3 text-sm font-semibold text-emerald-950">{state.ok}</p>}
      <button disabled={pending} className={buttonClass}>{pending ? "Saving..." : "Save mix"}</button>
    </form>
  );
}
