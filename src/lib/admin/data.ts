import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const RECIPE_IMAGE_BUCKET = "recipe-images";

export type ProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  favorite_category: string | null;
  avatar_url: string | null;
  is_superadmin: boolean;
  created_at: string;
  updated_at: string;
};

export type RecipeRow = {
  id: number;
  user_id: string;
  pantry: string;
  diet: string | null;
  title: string;
  description: string;
  ingredients: { item: string; amount: string }[];
  steps: string[];
  minutes: number | null;
  servings: number | null;
  image_path: string | null;
  model: string;
  image_model: string | null;
  rating_count: number;
  rating_sum: number;
  avg_rating: number;
  created_at: string;
};

export type RatingRow = {
  user_id: string;
  recipe_id: number;
  stars: number;
  created_at: string;
  updated_at: string;
};

export type FavoriteRow = { user_id: string; recipe_id: number; created_at: string };

export const RECIPE_LIST_COLUMNS =
  "id, user_id, pantry, diet, title, description, minutes, servings, image_path, model, image_model, rating_count, rating_sum, avg_rating, created_at";

/** Reads every row of a table, 1000 at a time (PostgREST caps a single response). */
export async function fetchAll<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  orderBy = "created_at"
): Promise<T[]> {
  const page = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(orderBy, { ascending: false })
      .range(from, from + page - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < page) break;
  }
  return rows;
}

export function recipeImageUrl(path: string | null) {
  if (!path) return null;
  const { url } = getSupabaseEnv();
  return `${url}/storage/v1/object/public/${RECIPE_IMAGE_BUCKET}/${path}`;
}

export function displayName(p: Pick<ProfileRow, "first_name" | "last_name" | "email"> | null | undefined) {
  if (!p) return "Unknown cook";
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return name || p.email || "Unnamed cook";
}

export function isSimulated(p: Pick<ProfileRow, "email"> | null | undefined) {
  return Boolean(p?.email?.endsWith(".test"));
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "America/New_York",
});
const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});
export const fmtDate = (iso: string) => dateFmt.format(new Date(iso));
export const fmtDateTime = (iso: string) => dateTimeFmt.format(new Date(iso));

// ---------------------------------------------------------------- Week 7 ----

export type ChainStepRow = {
  id: number;
  chain_id: number;
  step_order: number;
  name: string;
  kind: "recipe_text" | "dish_image";
  model_id: number;
  system_prompt: string;
  user_prompt_template: string;
  created_at: string;
  updated_at: string;
  llm_models: { id: number; display_name: string; model_id: string; is_active: boolean; llm_providers: { name: string; is_active: boolean } | null } | null;
};

export type ChainRow = {
  id: number;
  slug: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  prompt_chain_mix: { weight: number; updated_at: string } | { weight: number; updated_at: string }[] | null;
  prompt_chain_steps: ChainStepRow[];
};

export const CHAIN_SELECT =
  "id, slug, name, description, is_active, created_at, updated_at, prompt_chain_mix(weight, updated_at), prompt_chain_steps(id, chain_id, step_order, name, kind, model_id, system_prompt, user_prompt_template, created_at, updated_at, llm_models(id, display_name, model_id, is_active, llm_providers(name, is_active)))";

export const mixWeight = (c: ChainRow) => {
  const m = Array.isArray(c.prompt_chain_mix) ? c.prompt_chain_mix[0] : c.prompt_chain_mix;
  return m?.weight ?? 0;
};

/** A chain only receives traffic if it is active and every step's model + provider is active. */
export const chainProblems = (c: ChainRow) => {
  const out: string[] = [];
  if (!c.is_active) out.push("chain is inactive");
  if (!c.prompt_chain_steps.some((s) => s.kind === "recipe_text")) out.push("no recipe step");
  for (const s of c.prompt_chain_steps) {
    if (!s.llm_models?.is_active) out.push(`step ${s.step_order} model is off`);
    else if (!s.llm_models.llm_providers?.is_active) out.push(`step ${s.step_order} provider is off`);
  }
  return out;
};

export type GenerationRequestRow = {
  id: number;
  user_id: string;
  source: "app" | "admin";
  chain_id: number | null;
  chain_name: string | null;
  pantry: string;
  diet: string | null;
  status: "running" | "succeeded" | "failed";
  error: string | null;
  recipe_id: number | null;
  total_latency_ms: number | null;
  total_tokens: number | null;
  total_cost: number | null;
  created_at: string;
  finished_at: string | null;
};

export type LlmResponseRow = {
  id: number;
  request_id: number;
  step_id: number | null;
  step_order: number;
  step_name: string | null;
  kind: string;
  model_id: number | null;
  model_name: string;
  served_model: string | null;
  system_prompt: string;
  user_prompt: string;
  response_text: string | null;
  status: "ok" | "error";
  http_status: number | null;
  error: string | null;
  latency_ms: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cost: number | null;
  created_at: string;
};

export const fmtMs = (ms: number | null | undefined) =>
  ms == null ? "–" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
export const fmtCost = (c: number | null | undefined) =>
  c == null ? "–" : c === 0 ? "$0" : c < 0.01 ? `$${Number(c).toFixed(5)}` : `$${Number(c).toFixed(3)}`;

export function percentile(values: number[], p: number) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

export const daysAgoIso = (days: number) => new Date(Date.now() - days * 864e5).toISOString();
