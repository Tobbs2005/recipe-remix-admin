"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteResource, saveResource, toggleResource, type CrudState } from "@/app/(admin)/_crud/actions";
import type { Field } from "@/lib/admin/resources";
import { buttonClass, ghostButtonClass, inputClass } from "./ui";

export type RefOptions = Record<string, { value: string; label: string }[]>;

function Status({ state }: { state: CrudState }) {
  if (state.error) return <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{state.error}</p>;
  if (state.ok) return <p role="status" className="rounded-2xl bg-mint p-3 text-sm font-semibold text-emerald-950">{state.ok}</p>;
  return null;
}

function toInput(f: Field, v: unknown) {
  if (v == null) return f.defaultValue != null ? String(f.defaultValue) : "";
  if (f.type === "json") return JSON.stringify(v, null, 2);
  return String(v);
}

export function CrudForm({
  resourceKey,
  singular,
  id,
  fields,
  initial,
  refOptions,
}: {
  resourceKey: string;
  singular: string;
  id?: number;
  fields: Field[];
  initial?: Record<string, unknown>;
  refOptions: RefOptions;
}) {
  const action = saveResource.bind(null, resourceKey, id ?? null);
  const [state, formAction, pending] = useActionState<CrudState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-4">
      {fields.map((f) => {
        const value = initial ? initial[f.name] : undefined;
        const common = { name: f.name, id: `f-${f.name}`, required: f.required, placeholder: f.placeholder };
        const cls = `${inputClass} ${f.mono ? "font-mono text-xs" : ""}`;
        if (f.type === "checkbox") {
          const checked = value === undefined ? Boolean(f.defaultValue) : Boolean(value);
          return (
            <label key={f.name} className="flex items-center gap-2 text-sm font-bold text-zinc-700">
              <input type="checkbox" name={f.name} defaultChecked={checked} className="h-4 w-4 accent-emerald-600" />
              {f.label}
            </label>
          );
        }
        let control;
        if (f.type === "textarea" || f.type === "json") {
          control = <textarea {...common} rows={f.rows ?? 4} maxLength={f.type === "json" ? undefined : f.max} defaultValue={toInput(f, value)} className={cls} />;
        } else if (f.type === "select" || f.type === "ref") {
          const opts = f.type === "ref" ? (refOptions[f.name] ?? []) : (f.options ?? []);
          control = (
            <select {...common} defaultValue={toInput(f, value)} className={cls}>
              {(!f.required || f.type === "ref") && <option value="">{f.required ? "Choose..." : f.ref?.table === "prompt_chains" ? "Every chain" : "None"}</option>}
              {opts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          );
        } else if (f.type === "number") {
          control = <input {...common} type="number" min={f.min} max={f.max} step={f.step ?? "any"} defaultValue={toInput(f, value)} className={cls} />;
        } else {
          control = <input {...common} type="text" minLength={f.min} maxLength={f.max} defaultValue={toInput(f, value)} className={cls} />;
        }
        return (
          <label key={f.name} htmlFor={`f-${f.name}`} className="block">
            <span className="mb-1 block text-sm font-bold text-zinc-700">
              {f.label}
              {f.required && <span className="text-red-500"> *</span>}
            </span>
            {control}
            {f.hint && <span className="mt-1 block text-xs text-zinc-500">{f.hint}</span>}
          </label>
        );
      })}
      <Status state={state} />
      <button disabled={pending} className={buttonClass}>
        {pending ? "Saving..." : id ? "Save changes" : `Create ${singular}`}
      </button>
    </form>
  );
}

/** Two-step delete (no browser confirm dialog). */
export function CrudDeleteButton({ resourceKey, id, label, note }: { resourceKey: string; id: number; label: string; note?: string }) {
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!armed) {
    return (
      <button type="button" onClick={() => setArmed(true)} className={`${ghostButtonClass} hover:border-red-300 hover:text-red-700`}>
        🗑️ Delete
      </button>
    );
  }
  return (
    <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-3 text-sm">
      <p className="font-semibold text-red-800">Delete &ldquo;{label}&rdquo;? This can&apos;t be undone.</p>
      {note && <p className="mt-1 text-xs text-red-700">{note}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await deleteResource(resourceKey, id);
              if (r?.error) setError(r.error);
            })
          }
          className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {pending ? "Deleting..." : "Yes, delete"}
        </button>
        <button type="button" onClick={() => { setArmed(false); setError(null); }} className="rounded-full border-2 border-zinc-200 bg-white px-4 py-1.5 text-xs font-bold text-zinc-600">
          Cancel
        </button>
      </div>
      {error && <p className="mt-2 font-semibold text-red-700">{error}</p>}
    </div>
  );
}

export function CrudToggle({ resourceKey, id, column, value }: { resourceKey: string; id: number; column: string; value: boolean }) {
  const [on, setOn] = useState(value);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const next = !on;
          setOn(next);
          const r = await toggleResource(resourceKey, id, column, next);
          if (r?.error) setOn(!next);
        })
      }
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-60 ${on ? "bg-emerald-500" : "bg-zinc-300"}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${on ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}
