// Built-in fallback chain, used only when the database has no usable prompt chain.
// Cheap defaults: Gemini Flash for text, Gemini Flash Image for the dish photo.
export const RECIPE_MODEL = process.env.OPENROUTER_RECIPE_MODEL || "google/gemini-2.5-flash";
export const IMAGE_MODEL = process.env.OPENROUTER_IMAGE_MODEL || "google/gemini-2.5-flash-image";

export { DIETS, isDiet, type Diet } from "@/lib/diets";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export const RECIPE_SYSTEM_PROMPT = `You are a home cook who turns whatever is in someone's fridge into one great recipe.
Rules:
- Use mostly the ingredients given. You may assume pantry basics (salt, pepper, oil, water, common spices) and add at most 2 extra ingredients.
- Keep it realistic for a college student: under 60 minutes, common equipment.
- Respect the dietary preference strictly.
- Steps are short and imperative, 4 to 8 of them.
- Respond with JSON only:
{"title":"...","description":"one appetizing sentence","minutes":25,"servings":2,
 "ingredients":[{"item":"...","amount":"..."}],"steps":["..."],
 "image_prompt":"a short visual description of the finished plated dish"}`;

export type RecipeIngredient = { item: string; amount: string };
export type GeneratedRecipe = {
  title: string;
  description: string;
  minutes: number | null;
  servings: number | null;
  ingredients: RecipeIngredient[];
  steps: string[];
  imagePrompt: string;
};

function clean(v: unknown, max: number) {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function intOrNull(v: unknown, min: number, max: number) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

export function parseRecipe(raw: string): GeneratedRecipe | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    const o = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    const ingredients = (Array.isArray(o.ingredients) ? o.ingredients : [])
      .map((i) => {
        const r = (i ?? {}) as Record<string, unknown>;
        return typeof i === "string"
          ? { item: clean(i, 80), amount: "" }
          : { item: clean(r.item, 80), amount: clean(r.amount, 40) };
      })
      .filter((i) => i.item)
      .slice(0, 20);
    const steps = (Array.isArray(o.steps) ? o.steps : []).map((s) => clean(s, 400)).filter(Boolean).slice(0, 12);
    const title = clean(o.title, 120);
    if (!title || ingredients.length === 0 || steps.length === 0) return null;
    return {
      title,
      description: clean(o.description, 300),
      minutes: intOrNull(o.minutes, 1, 600),
      servings: intOrNull(o.servings, 1, 20),
      ingredients,
      steps,
      imagePrompt: clean(o.image_prompt, 300) || title,
    };
  } catch {
    return null;
  }
}

export const FALLBACK_USER_TEMPLATE = "Ingredients I have: {{pantry}}\nDietary preference: {{diet}}";
export const FALLBACK_IMAGE_TEMPLATE =
  "Appetizing overhead food photo of {{title}}: {{image_prompt}}. Natural light, home kitchen, on a simple plate, no text, no people.";
