"use client";

import { useActionState, useState, useTransition } from "react";
import { createRecipe, deleteRecipe, generateRecipeWithAI, updateRecipe, type FormState } from "@/app/(admin)/recipes/actions";
import { DIETS } from "@/lib/diets";
import { buttonClass, ghostButtonClass, inputClass } from "./ui";

export type RecipeFormValues = {
  title: string;
  description: string;
  pantry: string;
  diet: string;
  minutes: number | null;
  servings: number | null;
  ingredients: { item: string; amount: string }[];
  steps: string[];
};

const EMPTY: RecipeFormValues = {
  title: "",
  description: "",
  pantry: "",
  diet: "any",
  minutes: null,
  servings: null,
  ingredients: [],
  steps: [],
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-zinc-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

function Status({ state }: { state: FormState }) {
  if (state.error) return <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{state.error}</p>;
  if (state.ok) return <p className="rounded-2xl bg-mint p-3 text-sm font-semibold text-emerald-950">{state.ok}</p>;
  return null;
}

/** Shared create/edit form. `recipeId` switches it to edit mode. */
export function RecipeForm({ recipeId, initial = EMPTY, hasImage = false }: { recipeId?: number; initial?: RecipeFormValues; hasImage?: boolean }) {
  const action = recipeId ? updateRecipe.bind(null, recipeId) : createRecipe;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Title">
        <input name="title" required maxLength={120} defaultValue={initial.title} className={inputClass} />
      </Field>
      <Field label="Description" hint="One appetizing sentence (max 300 characters).">
        <textarea name="description" rows={2} maxLength={300} defaultValue={initial.description} className={inputClass} />
      </Field>
      <Field label="Pantry prompt" hint="The ingredients the cook typed in.">
        <input name="pantry" required minLength={2} maxLength={300} defaultValue={initial.pantry} className={inputClass} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Diet">
          <select name="diet" defaultValue={initial.diet} className={inputClass}>
            {Object.entries(DIETS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Minutes">
          <input name="minutes" type="number" min={1} max={600} defaultValue={initial.minutes ?? ""} className={inputClass} />
        </Field>
        <Field label="Servings">
          <input name="servings" type="number" min={1} max={20} defaultValue={initial.servings ?? ""} className={inputClass} />
        </Field>
      </div>
      <Field label="Ingredients" hint='One per line as "amount | item", e.g. "2 cups | cooked rice".'>
        <textarea
          name="ingredients"
          rows={6}
          required
          defaultValue={initial.ingredients.map((i) => (i.amount ? `${i.amount} | ${i.item}` : i.item)).join("\n")}
          className={`${inputClass} font-mono text-xs`}
        />
      </Field>
      <Field label="Steps" hint="One step per line.">
        <textarea name="steps" rows={6} required defaultValue={initial.steps.join("\n")} className={`${inputClass} text-sm`} />
      </Field>
      <Field label={hasImage ? "Replace dish photo" : "Dish photo"} hint="PNG, JPEG or WebP, up to 4 MB.">
        <input name="image" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-emerald-100 file:px-4 file:py-2 file:font-bold file:text-emerald-800" />
      </Field>
      {hasImage && (
        <label className="flex items-center gap-2 text-sm font-semibold text-zinc-600">
          <input type="checkbox" name="remove_image" className="h-4 w-4 accent-emerald-600" /> Remove current photo
        </label>
      )}
      <Status state={state} />
      <button disabled={pending} className={buttonClass}>
        {pending ? "Saving..." : recipeId ? "Save changes" : "Create recipe"}
      </button>
    </form>
  );
}

export function AIGenerateForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(generateRecipeWithAI, {});
  return (
    <form action={formAction} className="space-y-4">
      <Field label="What's in the fridge?" hint="Same prompt + models as the public app. Counts toward your 10 recipes / day.">
        <textarea name="pantry" rows={3} required minLength={2} maxLength={300} placeholder="eggs, leftover rice, kimchi, scallions" className={inputClass} />
      </Field>
      <Field label="Diet">
        <select name="diet" defaultValue="any" className={inputClass}>
          {Object.entries(DIETS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <Status state={state} />
      <button disabled={pending} className={buttonClass}>
        {pending ? "Cooking with AI (about 20s)..." : "✨ Generate recipe + photo"}
      </button>
    </form>
  );
}

/** Two-step delete (no browser confirm dialog). */
export function DeleteRecipeButton({ id, title }: { id: number; title: string }) {
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      {!armed ? (
        <button type="button" onClick={() => setArmed(true)} className={`${ghostButtonClass} hover:border-red-300 hover:text-red-700`}>
          🗑️ Delete recipe
        </button>
      ) : (
        <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-3 text-sm">
          <p className="font-semibold text-red-800">
            Delete &ldquo;{title}&rdquo;? Its photo, ratings and saves go with it. This can&apos;t be undone.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteRecipe(id);
                  if (res?.error) setError(res.error);
                })
              }
              className="rounded-full bg-red-600 px-4 py-2 font-bold text-white disabled:opacity-60"
            >
              {pending ? "Deleting..." : "Yes, delete it"}
            </button>
            <button type="button" onClick={() => setArmed(false)} className={ghostButtonClass}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
    </div>
  );
}
