import { DIETS, type Diet } from "@/lib/diets";
// Cheap defaults: Gemini Flash for text, Gemini Flash Image for the dish photo.
export const RECIPE_MODEL = process.env.OPENROUTER_RECIPE_MODEL || "google/gemini-2.5-flash";
const RECIPE_FALLBACKS = ["openai/gpt-4o-mini"];
export const IMAGE_MODEL = process.env.OPENROUTER_IMAGE_MODEL || "google/gemini-2.5-flash-image";

export { DIETS, isDiet, type Diet } from "@/lib/diets";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

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

function apiKey() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set on the server.");
  return key;
}

function headers() {
  return {
    Authorization: `Bearer ${apiKey()}`,
    "Content-Type": "application/json",
    "X-Title": "Recipe Remix (The Humor Project)",
  };
}

export function buildRecipePrompt(pantry: string, diet: Diet) {
  return `Ingredients I have: ${pantry}\nDietary preference: ${DIETS[diet]}`;
}

export async function generateRecipe(pantry: string, diet: Diet) {
  const userPrompt = buildRecipePrompt(pantry, diet);
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: RECIPE_MODEL,
      models: [RECIPE_MODEL, ...RECIPE_FALLBACKS],
      messages: [
        { role: "system", content: RECIPE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.9,
      max_tokens: 1500,
      reasoning: { enabled: false },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`The recipe model is unavailable right now (HTTP ${res.status}).`);

  const body = await res.json();
  const raw: string = body?.choices?.[0]?.message?.content ?? "";
  const model: string = body?.model ?? RECIPE_MODEL;
  const recipe = parseRecipe(raw);
  if (!recipe) throw new Error("The model returned an unusable recipe. Try again.");
  return { recipe, raw, model, systemPrompt: RECIPE_SYSTEM_PROMPT, userPrompt };
}

/** Returns PNG/JPEG bytes for the dish photo, or null if image generation fails. */
export async function generateDishImage(recipe: GeneratedRecipe) {
  const prompt = `Appetizing overhead food photo of ${recipe.title}: ${recipe.imagePrompt}. Natural light, home kitchen, on a simple plate, no text, no people.`;
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        model: IMAGE_MODEL,
        modalities: ["image", "text"],
        messages: [{ role: "user", content: prompt }],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return null;
    const body = await res.json();
    const url: string | undefined = body?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const match = url?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
    if (!match) return null;
    return { bytes: Buffer.from(match[2], "base64"), mime: match[1], model: (body?.model as string) ?? IMAGE_MODEL };
  } catch {
    return null;
  }
}

function clean(v: unknown, max: number) {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function intOrNull(v: unknown, min: number, max: number) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function parseRecipe(raw: string): GeneratedRecipe | null {
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
