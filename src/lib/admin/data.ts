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
