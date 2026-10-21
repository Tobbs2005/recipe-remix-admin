import type { FavoriteRow, ProfileRow, RatingRow, RecipeRow } from "./data";

const TZ = "America/New_York";
const hourFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: TZ });
const dowFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: TZ });
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }); // YYYY-MM-DD
export const DOWS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Words that show up in pantry lists but aren't ingredients. */
const STOP = new Set(["and", "some", "a", "an", "the", "of", "few", "leftover", "half", "fresh", "frozen", "old", "bag", "can", "cans", "jar", "box"]);

/** Naive singular for the last word: berries -> berry, tomatoes -> tomato, eggs -> egg. */
function singular(s: string) {
  if (/ies$/.test(s)) return s.replace(/ies$/, "y");
  if (/oes$/.test(s)) return s.replace(/es$/, "");
  if (/(ch|sh|x)es$/.test(s)) return s.replace(/es$/, "");
  if (/[^su]s$/.test(s) && s.length > 3) return s.slice(0, -1);
  return s;
}

/** "2 eggs,leftover rice & a bit of kimchi" -> ["egg", "rice", "kimchi"] */
export function parsePantry(pantry: string) {
  return pantry
    .toLowerCase()
    .split(/,|;|\/|\+|&|\band\b|\n/)
    .map((s) =>
      s
        .replace(/[^a-z\s-]/g, " ")
        .split(/\s+/)
        .filter((w) => w && !STOP.has(w) && !/^(bit|bits|cup|cups|tbsp|tsp|lb|lbs|oz|g|kg|ml|piece|pieces|slice|slices)$/.test(w))
        .join(" ")
        .trim()
    )
    .map(singular)
    .filter((s) => s.length >= 2 && s.length <= 24);
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const stdev = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

export function computeStats(data: {
  profiles: ProfileRow[];
  recipes: RecipeRow[];
  ratings: RatingRow[];
  favorites: FavoriteRow[];
}) {
  const { profiles, recipes, ratings, favorites } = data;
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const recipeById = new Map(recipes.map((r) => [r.id, r]));

  // ---- Headline numbers -----------------------------------------------------
  const avgStars = mean(ratings.map((r) => r.stars));
  const withPhoto = recipes.filter((r) => r.image_path).length;
  const unrated = recipes.filter((r) => r.rating_count === 0).length;
  const activeCooks = new Set(recipes.map((r) => r.user_id)).size;
  const activeRaters = new Set(ratings.map((r) => r.user_id)).size;

  // ---- Kitchen clock: when does activity happen? (ET, day x hour) ----------
  const clock: number[][] = DOWS.map(() => Array(24).fill(0));
  const bump = (iso: string) => {
    const d = new Date(iso);
    const dow = DOWS.indexOf(dowFmt.format(d));
    const hour = Number(hourFmt.format(d)) % 24;
    if (dow >= 0) clock[dow][hour] += 1;
  };
  recipes.forEach((r) => bump(r.created_at));
  ratings.forEach((r) => bump(r.created_at));
  let peak = { dow: 0, hour: 0, n: 0 };
  clock.forEach((row, dow) => row.forEach((n, hour) => n > peak.n && (peak = { dow, hour, n })));

  // ---- Last 30 days of new recipes and ratings -------------------------------
  const days: { key: string; recipes: number; ratings: number }[] = [];
  const now = Date.now();
  for (let i = 29; i >= 0; i--) {
    days.push({ key: dayKeyFmt.format(new Date(now - i * 86_400_000)), recipes: 0, ratings: 0 });
  }
  const dayIdx = new Map(days.map((d, i) => [d.key, i]));
  recipes.forEach((r) => {
    const i = dayIdx.get(dayKeyFmt.format(new Date(r.created_at)));
    if (i !== undefined) days[i].recipes += 1;
  });
  ratings.forEach((r) => {
    const i = dayIdx.get(dayKeyFmt.format(new Date(r.created_at)));
    if (i !== undefined) days[i].ratings += 1;
  });

  // ---- Star distribution -----------------------------------------------------
  const starDist = [1, 2, 3, 4, 5].map((s) => ({ stars: s, n: ratings.filter((r) => r.stars === s).length }));

  // ---- What's in the fridge: top pantry ingredients + how their recipes rate -
  const ing = new Map<string, { n: number; ratedSum: number; ratedN: number }>();
  for (const r of recipes) {
    for (const item of new Set(parsePantry(r.pantry))) {
      const e = ing.get(item) ?? { n: 0, ratedSum: 0, ratedN: 0 };
      e.n += 1;
      if (r.rating_count > 0) {
        e.ratedSum += r.rating_sum;
        e.ratedN += r.rating_count;
      }
      ing.set(item, e);
    }
  }
  const topIngredients = [...ing.entries()]
    .map(([item, e]) => ({ item, n: e.n, avg: e.ratedN ? e.ratedSum / e.ratedN : null }))
    .sort((a, b) => b.n - a.n || a.item.localeCompare(b.item))
    .slice(0, 12);

  // Ingredient that lifts ratings the most (min 3 recipes with ratings).
  const ingredientMvp = [...ing.entries()]
    .filter(([, e]) => e.n >= 3 && e.ratedN >= 3)
    .map(([item, e]) => ({ item, avg: e.ratedSum / e.ratedN, n: e.n }))
    .sort((a, b) => b.avg - a.avg)[0];

  // ---- Diet split ------------------------------------------------------------
  const dietMap = new Map<string, { n: number; sum: number; cnt: number }>();
  for (const r of recipes) {
    const k = r.diet || "any";
    const e = dietMap.get(k) ?? { n: 0, sum: 0, cnt: 0 };
    e.n += 1;
    e.sum += r.rating_sum;
    e.cnt += r.rating_count;
    dietMap.set(k, e);
  }
  const diets = [...dietMap.entries()]
    .map(([diet, e]) => ({ diet, n: e.n, avg: e.cnt ? e.sum / e.cnt : null }))
    .sort((a, b) => b.n - a.n);

  // ---- Does faster cook better? ---------------------------------------------
  const buckets = [
    { label: "Under 15 min", min: 0, max: 14 },
    { label: "15 to 29 min", min: 15, max: 29 },
    { label: "30 to 44 min", min: 30, max: 44 },
    { label: "45+ min", min: 45, max: 10_000 },
  ].map((b) => {
    const rs = recipes.filter((r) => r.minutes != null && r.minutes >= b.min && r.minutes <= b.max);
    const sum = rs.reduce((a, r) => a + r.rating_sum, 0);
    const cnt = rs.reduce((a, r) => a + r.rating_count, 0);
    return { label: b.label, recipes: rs.length, avg: cnt ? sum / cnt : null };
  });

  // ---- Critics corner: who rates harshest / sweetest (min 3 ratings) --------
  const byRater = new Map<string, number[]>();
  ratings.forEach((r) => byRater.set(r.user_id, [...(byRater.get(r.user_id) ?? []), r.stars]));
  const raters = [...byRater.entries()]
    .filter(([, s]) => s.length >= 3)
    .map(([id, s]) => ({ id, profile: profileById.get(id) ?? null, avg: mean(s), n: s.length }));
  const harshest = [...raters].sort((a, b) => a.avg - b.avg || b.n - a.n).slice(0, 3);
  const sweetest = [...raters].sort((a, b) => b.avg - a.avg || b.n - a.n).slice(0, 3);

  // ---- Recipes: hall of fame and most divisive -------------------------------
  const starsByRecipe = new Map<number, number[]>();
  ratings.forEach((r) => starsByRecipe.set(r.recipe_id, [...(starsByRecipe.get(r.recipe_id) ?? []), r.stars]));
  const hallOfFame = recipes
    .filter((r) => r.rating_count >= 2)
    .sort((a, b) => Number(b.avg_rating) - Number(a.avg_rating) || b.rating_count - a.rating_count)
    .slice(0, 5);
  const divisive = [...starsByRecipe.entries()]
    .filter(([, s]) => s.length >= 3)
    .map(([id, s]) => ({ recipe: recipeById.get(id), spread: stdev(s), stars: s }))
    .filter((d) => d.recipe)
    .sort((a, b) => b.spread - a.spread)
    .slice(0, 3);

  // ---- Most saved ------------------------------------------------------------
  const favCount = new Map<number, number>();
  favorites.forEach((f) => favCount.set(f.recipe_id, (favCount.get(f.recipe_id) ?? 0) + 1));
  const mostSaved = [...favCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, n]) => ({ recipe: recipeById.get(id), n }))
    .filter((d) => d.recipe);

  // ---- Top chefs: most recipes, with their average -------------------------
  const byChef = new Map<string, RecipeRow[]>();
  recipes.forEach((r) => byChef.set(r.user_id, [...(byChef.get(r.user_id) ?? []), r]));
  const topChefs = [...byChef.entries()]
    .map(([id, rs]) => {
      const cnt = rs.reduce((a, r) => a + r.rating_count, 0);
      const sum = rs.reduce((a, r) => a + r.rating_sum, 0);
      return { id, profile: profileById.get(id) ?? null, n: rs.length, avg: cnt ? sum / cnt : null };
    })
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);

  // ---- Models used -------------------------------------------------------------
  const modelMap = new Map<string, number>();
  recipes.forEach((r) => modelMap.set(r.model, (modelMap.get(r.model) ?? 0) + 1));
  const models = [...modelMap.entries()].map(([model, n]) => ({ model, n })).sort((a, b) => b.n - a.n);

  // ---- Self-raters: people who rated their own recipe -----------------------
  const selfRatings = ratings.filter((r) => recipeById.get(r.recipe_id)?.user_id === r.user_id);

  return {
    totals: {
      users: profiles.length,
      admins: profiles.filter((p) => p.is_superadmin).length,
      recipes: recipes.length,
      ratings: ratings.length,
      favorites: favorites.length,
      avgStars,
      withPhoto,
      unrated,
      activeCooks,
      activeRaters,
      selfRatings: selfRatings.length,
      selfRatingAvg: mean(selfRatings.map((r) => r.stars)),
    },
    clock,
    peak,
    days,
    starDist,
    topIngredients,
    ingredientMvp,
    diets,
    buckets,
    harshest,
    sweetest,
    hallOfFame,
    divisive,
    mostSaved,
    topChefs,
    models,
  };
}

export type Stats = ReturnType<typeof computeStats>;
