export const DIETS = {
  any: "No restrictions",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  "high-protein": "High protein",
  "dorm-friendly": "Dorm friendly (microwave / one pan)",
} as const;
export type Diet = keyof typeof DIETS;
export const isDiet = (d: string): d is Diet => d in DIETS;

export const DIET_STYLE: Record<Diet, { emoji: string; chip: string }> = {
  any: { emoji: "🍽️", chip: "bg-butter text-amber-800" },
  vegetarian: { emoji: "🥕", chip: "bg-amber-100 text-amber-800" },
  vegan: { emoji: "🌱", chip: "bg-mint text-emerald-900" },
  "high-protein": { emoji: "💪", chip: "bg-sky text-sky-900" },
  "dorm-friendly": { emoji: "🏠", chip: "bg-lilac text-violet-900" },
};

/** Cute emoji for common ingredients, used on chips. */
const INGREDIENT_EMOJI: [RegExp, string][] = [
  [/egg/, "🥚"], [/rice/, "🍚"], [/chicken/, "🍗"], [/beef|steak/, "🥩"], [/pork|bacon|ham/, "🥓"],
  [/fish|salmon|tuna/, "🐟"], [/shrimp|prawn/, "🍤"], [/tofu/, "🧈"], [/cheese|cheddar|mozz|parm/, "🧀"],
  [/milk|cream|yogurt/, "🥛"], [/butter/, "🧈"], [/bread|toast|bagel/, "🍞"], [/noodle|ramen|pasta|spaghetti|udon/, "🍜"],
  [/tomato/, "🍅"], [/potato/, "🥔"], [/carrot/, "🥕"], [/onion|scallion|shallot/, "🧅"], [/garlic/, "🧄"],
  [/pepper|chili|jalape/, "🌶️"], [/broccoli/, "🥦"], [/spinach|lettuce|kale|greens|cabbage/, "🥬"], [/corn/, "🌽"],
  [/mushroom/, "🍄"], [/avocado/, "🥑"], [/lemon|lime/, "🍋"], [/apple/, "🍎"], [/banana/, "🍌"], [/berr/, "🍓"],
  [/bean|chickpea|lentil/, "🫘"], [/kimchi|cucumber|pickle/, "🥒"], [/honey/, "🍯"], [/peanut|nut/, "🥜"],
  [/chocolate/, "🍫"], [/flour/, "🌾"], [/coconut/, "🥥"],
];

export function ingredientEmoji(name: string) {
  const n = name.toLowerCase();
  return INGREDIENT_EMOJI.find(([re]) => re.test(n))?.[1] ?? "🥄";
}
