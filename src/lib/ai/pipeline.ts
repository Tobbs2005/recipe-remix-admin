import type { SupabaseClient } from "@supabase/supabase-js";
import { DIETS, type Diet } from "@/lib/diets";
import {
  FALLBACK_IMAGE_TEMPLATE,
  FALLBACK_USER_TEMPLATE,
  IMAGE_MODEL,
  OPENROUTER_BASE_URL,
  parseRecipe,
  RECIPE_MODEL,
  RECIPE_SYSTEM_PROMPT,
  type GeneratedRecipe,
} from "./recipes";

/**
 * Recipe generation driven by the database:
 *   llm_providers -> llm_models -> prompt_chain_steps, chain picked by prompt_chain_mix,
 *   terms + generation_examples injected into prompts,
 *   every run logged to generation_requests and every model call to llm_responses.
 * Falls back to the built-in chain if the database has nothing usable.
 */

const RECIPE_IMAGE_BUCKET = "recipe-images";

type Provider = { id: number; name: string; slug: string; base_url: string; api_key_env: string; is_active: boolean };
type Model = {
  id: number | null;
  model_id: string;
  kind: string;
  temperature: number | null;
  max_tokens: number | null;
  input_cost_per_mtok: number;
  output_cost_per_mtok: number;
  is_active: boolean;
  llm_providers: Provider;
};
type Step = {
  id: number | null;
  step_order: number;
  name: string;
  kind: "recipe_text" | "dish_image";
  system_prompt: string;
  user_prompt_template: string;
  llm_models: Model;
};
type Chain = { id: number | null; name: string; steps: Step[] };

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

const OPENROUTER: Provider = {
  id: 0,
  name: "OpenRouter",
  slug: "openrouter",
  base_url: OPENROUTER_BASE_URL,
  api_key_env: "OPENROUTER_API_KEY",
  is_active: true,
};
const builtinModel = (model_id: string, kind: string): Model => ({
  id: null,
  model_id,
  kind,
  temperature: kind === "text" ? 0.9 : null,
  max_tokens: kind === "text" ? 1500 : null,
  input_cost_per_mtok: 0,
  output_cost_per_mtok: 0,
  is_active: true,
  llm_providers: OPENROUTER,
});
const FALLBACK_CHAIN: Chain = {
  id: null,
  name: "Built-in fallback",
  steps: [
    { id: null, step_order: 1, name: "Write the recipe", kind: "recipe_text", system_prompt: RECIPE_SYSTEM_PROMPT, user_prompt_template: FALLBACK_USER_TEMPLATE, llm_models: builtinModel(RECIPE_MODEL, "text") },
    { id: null, step_order: 2, name: "Photograph the dish", kind: "dish_image", system_prompt: "", user_prompt_template: FALLBACK_IMAGE_TEMPLATE, llm_models: builtinModel(IMAGE_MODEL, "image") },
  ],
};

function usable(step: Step) {
  const m = step.llm_models;
  const p = m?.llm_providers;
  return Boolean(m?.is_active && p?.is_active && process.env[p.api_key_env]);
}

/** Weighted random pick over active chains whose models + providers are all usable. */
async function pickChain(supabase: SupabaseClient): Promise<Chain> {
  const { data, error } = await supabase
    .from("prompt_chains")
    .select(
      "id, name, is_active, prompt_chain_mix(weight), prompt_chain_steps(id, step_order, name, kind, system_prompt, user_prompt_template, llm_models(id, model_id, kind, temperature, max_tokens, input_cost_per_mtok, output_cost_per_mtok, is_active, llm_providers(id, name, slug, base_url, api_key_env, is_active)))"
    );
  if (error || !data) return FALLBACK_CHAIN;

  const candidates = data
    .map((c) => {
      const steps = ((c.prompt_chain_steps ?? []) as unknown as Step[])
        .map((s) => {
          const m = one(s.llm_models as Model | Model[]);
          return m ? { ...s, llm_models: { ...m, llm_providers: one(m.llm_providers as Provider | Provider[])! } } : null;
        })
        .filter((s): s is Step => Boolean(s?.llm_models?.llm_providers))
        .sort((a, b) => a.step_order - b.step_order);
      const weight = Number(one(c.prompt_chain_mix as { weight: number } | { weight: number }[])?.weight ?? 0);
      return { chain: { id: c.id as number, name: c.name as string, steps }, weight, active: c.is_active as boolean };
    })
    .filter(
      ({ chain, weight, active }) =>
        active && weight > 0 && chain.steps.some((s) => s.kind === "recipe_text") && chain.steps.every(usable)
    );

  const total = candidates.reduce((a, c) => a + c.weight, 0);
  if (!total) return FALLBACK_CHAIN;
  let roll = Math.random() * total;
  for (const c of candidates) {
    roll -= c.weight;
    if (roll < 0) return c.chain;
  }
  return candidates[candidates.length - 1].chain;
}

async function promptContext(supabase: SupabaseClient, chainId: number | null) {
  const [{ data: terms }, { data: examples }] = await Promise.all([
    supabase.from("terms").select("term, definition").eq("include_in_prompt", true).order("term").limit(30),
    supabase
      .from("generation_examples")
      .select("label, pantry, diet, output, chain_id")
      .eq("is_active", true)
      .order("id")
      .limit(20),
  ]);
  const termText = terms?.length
    ? `Kitchen glossary (use these terms correctly when they fit):\n${terms.map((t) => `- ${t.term}: ${t.definition}`).join("\n")}`
    : "";
  const ex = (examples ?? []).filter((e) => e.chain_id == null || e.chain_id === chainId).slice(0, 3);
  const exampleText = ex.length
    ? `Examples of great answers:\n${ex
        .map((e) => `Ingredients I have: ${e.pantry}\nDietary preference: ${DIETS[e.diet as Diet] ?? e.diet}\nJSON: ${JSON.stringify(e.output)}`)
        .join("\n\n")}`
    : "";
  return { terms: termText, examples: exampleText };
}

function render(template: string, vars: Record<string, string>) {
  return template
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => vars[k] ?? "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type CallResult = {
  ok: boolean;
  text: string;
  served: string | null;
  http: number | null;
  latency: number;
  promptTokens: number | null;
  completionTokens: number | null;
  cost: number | null;
  error: string | null;
  image?: { bytes: Buffer; mime: string };
};

async function callModel(step: Step, system: string, user: string): Promise<CallResult> {
  const m = step.llm_models;
  const p = m.llm_providers;
  const isImage = step.kind === "dish_image";
  const t0 = Date.now();
  const fail = (error: string, http: number | null = null): CallResult => ({
    ok: false, text: "", served: null, http, latency: Date.now() - t0, promptTokens: null, completionTokens: null, cost: null, error,
  });
  const key = process.env[p.api_key_env];
  if (!key) return fail(`${p.api_key_env} is not set on the server.`);

  const messages = [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: user }];
  const body: Record<string, unknown> = { model: m.model_id, messages };
  if (isImage) body.modalities = ["image", "text"];
  else {
    body.response_format = { type: "json_object" };
    if (m.temperature != null) body.temperature = Number(m.temperature);
    if (m.max_tokens != null) body.max_tokens = m.max_tokens;
  }
  if (p.slug === "openrouter") {
    body.usage = { include: true };
    if (!isImage) body.reasoning = { enabled: false };
  }

  let res: Response;
  try {
    res = await fetch(`${p.base_url.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Recipe Remix (The Humor Project)" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(isImage ? 60_000 : 30_000),
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Network error");
  }
  const latency = Date.now() - t0;
  const json = await res.json().catch(() => null);
  if (!res.ok) return { ...fail(json?.error?.message ?? `HTTP ${res.status}`, res.status), latency };

  const msg = json?.choices?.[0]?.message ?? {};
  const usage = json?.usage ?? {};
  const promptTokens = Number.isFinite(usage.prompt_tokens) ? usage.prompt_tokens : null;
  const completionTokens = Number.isFinite(usage.completion_tokens) ? usage.completion_tokens : null;
  const estimated =
    promptTokens != null || completionTokens != null
      ? ((promptTokens ?? 0) * Number(m.input_cost_per_mtok) + (completionTokens ?? 0) * Number(m.output_cost_per_mtok)) / 1e6
      : null;
  const cost = typeof usage.cost === "number" ? usage.cost : estimated;
  const base = { http: res.status, latency, promptTokens, completionTokens, cost, served: (json?.model as string) ?? m.model_id };
  const text: string = typeof msg.content === "string" ? msg.content : "";

  if (isImage) {
    const url: string | undefined = msg.images?.[0]?.image_url?.url;
    const match = url?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
    if (!match) return { ...base, ok: false, text, error: "No image in the response." };
    const bytes = Buffer.from(match[2], "base64");
    const summary = `[${match[1]} image, ${Math.round(bytes.length / 1024)} KB]${text ? `\n${text}` : ""}`;
    return { ...base, ok: true, text: summary, error: null, image: { bytes, mime: match[1] } };
  }
  if (!text) return { ...base, ok: false, text, error: "Empty response." };
  return { ...base, ok: true, text, error: null };
}

export type PipelineResult = { ok: true; recipeId: number; requestId: number | null } | { ok: false; error: string; requestId: number | null };

export async function runRecipePipeline(
  supabase: SupabaseClient,
  userId: string,
  pantry: string,
  diet: Diet,
  source: "app" | "admin"
): Promise<PipelineResult> {
  const chain = await pickChain(supabase);
  const ctx = await promptContext(supabase, chain.id);
  const t0 = Date.now();
  let tokens = 0;
  let cost = 0;

  const { data: req } = await supabase
    .from("generation_requests")
    .insert({ user_id: userId, source, chain_id: chain.id, chain_name: chain.name, pantry, diet })
    .select("id")
    .single();
  const requestId: number | null = req?.id ?? null;

  const log = async (step: Step, system: string, user: string, r: CallResult) => {
    tokens += (r.promptTokens ?? 0) + (r.completionTokens ?? 0);
    cost += r.cost ?? 0;
    if (!requestId) return;
    const { error } = await supabase.from("llm_responses").insert({
      request_id: requestId,
      step_id: step.id,
      step_order: step.step_order,
      step_name: step.name,
      kind: step.kind,
      model_id: step.llm_models.id,
      model_name: step.llm_models.model_id,
      served_model: r.served,
      system_prompt: system,
      user_prompt: user,
      response_text: r.text.slice(0, 20000),
      status: r.ok ? "ok" : "error",
      http_status: r.http,
      error: r.error,
      latency_ms: r.latency,
      prompt_tokens: r.promptTokens,
      completion_tokens: r.completionTokens,
      cost: r.cost,
    });
    if (error) console.error("llm_responses insert failed:", error.message);
  };
  const finish = async (status: "succeeded" | "failed", extra: { error?: string; recipe_id?: number }) => {
    if (!requestId) return;
    await supabase
      .from("generation_requests")
      .update({ status, ...extra, total_latency_ms: Date.now() - t0, total_tokens: tokens, total_cost: cost, finished_at: new Date().toISOString() })
      .eq("id", requestId);
  };
  const failWith = async (error: string): Promise<PipelineResult> => {
    await finish("failed", { error });
    return { ok: false, error, requestId };
  };

  const vars: Record<string, string> = { pantry, diet: DIETS[diet], terms: ctx.terms, examples: ctx.examples };
  let recipe: GeneratedRecipe | null = null;
  let recipeId: number | null = null;

  for (const step of chain.steps) {
    const system = render(step.system_prompt, vars);
    const user = render(step.user_prompt_template, vars);

    if (step.kind === "recipe_text") {
      const r = await callModel(step, system, user);
      const parsed = r.ok ? parseRecipe(r.text) : null;
      if (r.ok && !parsed) {
        r.ok = false;
        r.error = "Response was not a usable recipe JSON.";
      }
      await log(step, system, user, r);
      if (!parsed) return failWith(r.error ?? "The recipe model is unavailable right now.");
      recipe = parsed;
      vars.title = parsed.title;
      vars.image_prompt = parsed.imagePrompt;

      // Save now: the insert trigger enforces the daily limit before we pay for an image.
      const { data: row, error } = await supabase
        .from("recipes")
        .insert({
          user_id: userId,
          pantry,
          diet,
          title: parsed.title,
          description: parsed.description,
          ingredients: parsed.ingredients,
          steps: parsed.steps,
          minutes: parsed.minutes,
          servings: parsed.servings,
          model: r.served ?? step.llm_models.model_id,
          image_model: chain.steps.find((s) => s.kind === "dish_image")?.llm_models.model_id ?? null,
          system_prompt: system,
          user_prompt: user,
          raw_response: r.text,
        })
        .select("id")
        .single();
      if (error || !row) return failWith(error?.message ?? "Could not save recipe.");
      recipeId = row.id as number;
    } else if (step.kind === "dish_image" && recipe && recipeId) {
      // If the photo fails, the recipe still exists without one.
      const r = await callModel(step, system, user);
      if (r.ok && r.image) {
        const ext = r.image.mime === "image/jpeg" ? "jpg" : r.image.mime.split("/")[1];
        const path = `${userId}/${recipeId}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(RECIPE_IMAGE_BUCKET)
          .upload(path, r.image.bytes, { contentType: r.image.mime, upsert: false });
        if (upErr) {
          r.ok = false;
          r.error = `Upload failed: ${upErr.message}`;
        } else {
          await supabase.from("recipes").update({ image_path: path }).eq("id", recipeId);
        }
      }
      await log(step, system, user, r);
    }
  }

  if (!recipeId) return failWith("This prompt chain has no recipe step.");
  await finish("succeeded", { recipe_id: recipeId });
  return { ok: true, recipeId, requestId };
}
