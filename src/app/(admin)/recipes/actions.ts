"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runRecipePipeline } from "@/lib/ai/pipeline";
import { isDiet } from "@/lib/ai/recipes";
import { requireAdmin } from "@/lib/admin/auth";
import { RECIPE_IMAGE_BUCKET } from "@/lib/admin/data";

export type FormState = { error?: string; ok?: string };

const MAX_IMAGE = 4 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

type Parsed = {
  title: string;
  description: string;
  pantry: string;
  diet: string;
  minutes: number | null;
  servings: number | null;
  ingredients: { item: string; amount: string }[];
  steps: string[];
};

/** Validates the shared recipe form. Ingredients are "amount | item" per line, steps one per line. */
function parseForm(fd: FormData): Parsed | string {
  const str = (k: string) => String(fd.get(k) ?? "").trim();
  const int = (k: string, min: number, max: number) => {
    const v = str(k);
    if (!v) return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max ? n : NaN;
  };
  const title = str("title").replace(/\s+/g, " ");
  const pantry = str("pantry").replace(/\s+/g, " ");
  const diet = str("diet") || "any";
  const minutes = int("minutes", 1, 600);
  const servings = int("servings", 1, 20);
  const ingredients = str("ingredients")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [a, ...rest] = l.split("|");
      return rest.length ? { amount: a.trim(), item: rest.join("|").trim() } : { amount: "", item: a.trim() };
    })
    .filter((i) => i.item);
  const steps = str("steps")
    .split("\n")
    .map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);

  if (title.length < 1 || title.length > 120) return "Title must be 1 to 120 characters.";
  if (pantry.length < 2 || pantry.length > 300) return "Pantry must be 2 to 300 characters.";
  if (!isDiet(diet)) return "Pick a valid diet.";
  if (Number.isNaN(minutes)) return "Minutes must be a whole number from 1 to 600.";
  if (Number.isNaN(servings)) return "Servings must be a whole number from 1 to 20.";
  if (ingredients.length === 0) return "Add at least one ingredient.";
  if (steps.length === 0) return "Add at least one step.";
  return { title, description: str("description").slice(0, 300), pantry, diet, minutes, servings, ingredients, steps };
}

function imageFile(fd: FormData): File | null | string {
  const f = fd.get("image");
  if (!(f instanceof File) || f.size === 0) return null;
  if (!IMAGE_TYPES.includes(f.type)) return "Image must be PNG, JPEG or WebP.";
  if (f.size > MAX_IMAGE) return "Image must be 4 MB or smaller.";
  return f;
}

async function uploadImage(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  adminId: string,
  recipeId: number,
  body: Blob | Buffer,
  mime: string
) {
  const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
  const path = `${adminId}/${recipeId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(RECIPE_IMAGE_BUCKET).upload(path, body, { contentType: mime, upsert: false });
  if (error) throw new Error(`Image upload failed: ${error.message}`);
  return path;
}

// ---------------------------------------------------------------- CREATE ----

export async function createRecipe(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user } = await requireAdmin();
  const parsed = parseForm(fd);
  if (typeof parsed === "string") return { error: parsed };
  const img = imageFile(fd);
  if (typeof img === "string") return { error: img };

  const { data: row, error } = await supabase
    .from("recipes")
    .insert({
      user_id: user.id,
      ...parsed,
      model: "admin/manual",
      system_prompt: "(created by hand in the admin panel)",
      user_prompt: `Ingredients I have: ${parsed.pantry}`,
    })
    .select("id")
    .single();
  if (error || !row) return { error: error?.message ?? "Could not create recipe." };

  if (img) {
    try {
      const path = await uploadImage(supabase, user.id, row.id, img, img.type);
      await supabase.rpc("admin_update_recipe", rpcArgs(row.id, parsed, path));
    } catch (e) {
      return { error: `Recipe #${row.id} was created, but ${e instanceof Error ? e.message : "the image failed"}.` };
    }
  }

  revalidatePath("/recipes");
  redirect(`/recipes/${row.id}?created=1`);
}

export async function generateRecipeWithAI(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user } = await requireAdmin();
  const pantry = String(fd.get("pantry") ?? "").replace(/\s+/g, " ").trim();
  const diet = String(fd.get("diet") ?? "any");
  if (pantry.length < 2 || pantry.length > 300) return { error: "List ingredients (2 to 300 characters)." };
  if (!isDiet(diet)) return { error: "Pick a valid diet." };

  // Same database-driven prompt chain as the public app, logged with source = admin.
  const result = await runRecipePipeline(supabase, user.id, pantry, diet, "admin");
  if (!result.ok) return { error: result.error };

  revalidatePath("/recipes");
  revalidatePath("/requests");
  redirect(`/recipes/${result.recipeId}?created=1`);
}

// ---------------------------------------------------------------- UPDATE ----

function rpcArgs(id: number, p: Parsed, imagePath: string | null) {
  return {
    p_id: id,
    p_title: p.title,
    p_description: p.description,
    p_pantry: p.pantry,
    p_diet: p.diet,
    p_ingredients: p.ingredients,
    p_steps: p.steps,
    p_minutes: p.minutes,
    p_servings: p.servings,
    p_image_path: imagePath,
  };
}

export async function updateRecipe(id: number, _prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user } = await requireAdmin();
  const parsed = parseForm(fd);
  if (typeof parsed === "string") return { error: parsed };
  const img = imageFile(fd);
  if (typeof img === "string") return { error: img };

  const { data: current } = await supabase.from("recipes").select("image_path").eq("id", id).maybeSingle();
  if (!current) return { error: "Recipe not found." };

  let imagePath: string | null = current.image_path;
  const oldPath = current.image_path;
  try {
    if (img) imagePath = await uploadImage(supabase, user.id, id, img, img.type);
    else if (fd.get("remove_image") === "on") imagePath = null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Image upload failed." };
  }

  const { error } = await supabase.rpc("admin_update_recipe", rpcArgs(id, parsed, imagePath));
  if (error) return { error: error.message };

  // Clean up the old photo once nothing points at it.
  if (oldPath && oldPath !== imagePath) await supabase.storage.from(RECIPE_IMAGE_BUCKET).remove([oldPath]);

  revalidatePath("/recipes");
  revalidatePath(`/recipes/${id}`);
  return { ok: "Saved." };
}

// ---------------------------------------------------------------- DELETE ----

export async function deleteRecipe(id: number): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const { data: current } = await supabase.from("recipes").select("image_path").eq("id", id).maybeSingle();
  if (!current) return { error: "Recipe not found." };

  // Ratings and favorites cascade with the row.
  const { error, count } = await supabase.from("recipes").delete({ count: "exact" }).eq("id", id);
  if (error) return { error: error.message };
  if (!count) return { error: "Delete was blocked (are you still a superadmin?)." };
  if (current.image_path) await supabase.storage.from(RECIPE_IMAGE_BUCKET).remove([current.image_path]);

  revalidatePath("/recipes");
  redirect("/recipes?deleted=1");
}
