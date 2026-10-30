import { DIETS } from "@/lib/diets";

/**
 * Config for the generic create/read/update/delete screens. Plain data only,
 * so the same definitions drive the server actions and the client forms.
 */
export type FieldType = "text" | "textarea" | "number" | "checkbox" | "select" | "ref" | "json";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  min?: number;
  max?: number; // number range, or max length for text
  step?: number;
  hint?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  ref?: { table: string; label: string; filter?: { column: string; value: string } };
  nullable?: boolean; // empty input saves NULL
  transform?: "lower" | "domain" | "slug" | "env";
  pattern?: { re: string; message: string };
  mono?: boolean;
  rows?: number;
  defaultValue?: string | number | boolean;
};

export type Column = {
  name: string;
  label: string;
  kind?: "bool" | "date" | "ref" | "mono" | "money" | "truncate" | "json";
  ref?: { table: string; label: string };
};

export type Resource = {
  key: string;
  table: string;
  title: string;
  singular: string;
  icon: string;
  description: string;
  fields: Field[];
  columns: Column[];
  search: string[];
  orderBy: string;
  asc?: boolean;
  deleteNote?: string;
};

const DIET_OPTIONS = Object.entries(DIETS).map(([value, label]) => ({ value, label }));

export const RESOURCES: Record<string, Resource> = {
  terms: {
    key: "terms",
    table: "terms",
    title: "Terms",
    singular: "term",
    icon: "📖",
    description: "Kitchen glossary. Terms marked “in prompt” are added to every recipe prompt through {{terms}}.",
    orderBy: "term",
    asc: true,
    search: ["term", "definition", "category"],
    fields: [
      { name: "term", label: "Term", type: "text", required: true, max: 60, placeholder: "Deglaze" },
      { name: "definition", label: "Definition", type: "textarea", required: true, max: 500, rows: 3 },
      { name: "category", label: "Category", type: "text", required: true, max: 40, transform: "lower", defaultValue: "technique", hint: "e.g. technique, doneness, ingredient" },
      { name: "include_in_prompt", label: "Include in recipe prompts", type: "checkbox", defaultValue: true },
    ],
    columns: [
      { name: "term", label: "Term" },
      { name: "definition", label: "Definition", kind: "truncate" },
      { name: "category", label: "Category" },
      { name: "include_in_prompt", label: "In prompt", kind: "bool" },
      { name: "updated_at", label: "Updated", kind: "date" },
    ],
  },
  examples: {
    key: "examples",
    table: "generation_examples",
    title: "Generation examples",
    singular: "example",
    icon: "🧪",
    description: "Few-shot examples. Up to 3 active ones (for the chosen chain, or for every chain) go into the prompt through {{examples}}.",
    orderBy: "id",
    search: ["label", "pantry"],
    fields: [
      { name: "label", label: "Label", type: "text", required: true, max: 80 },
      { name: "chain_id", label: "Prompt chain", type: "ref", nullable: true, ref: { table: "prompt_chains", label: "name" }, hint: "Leave on “Every chain” to use it everywhere." },
      { name: "pantry", label: "Pantry input", type: "text", required: true, min: 2, max: 300, placeholder: "eggs, leftover rice, kimchi" },
      { name: "diet", label: "Diet", type: "select", required: true, options: DIET_OPTIONS, defaultValue: "any" },
      { name: "output", label: "Ideal output (recipe JSON)", type: "json", required: true, rows: 12, mono: true, hint: 'Same shape the model must return: {"title","description","minutes","servings","ingredients":[{"item","amount"}],"steps":[],"image_prompt"}' },
      { name: "is_active", label: "Active", type: "checkbox", defaultValue: true },
    ],
    columns: [
      { name: "label", label: "Label" },
      { name: "chain_id", label: "Chain", kind: "ref", ref: { table: "prompt_chains", label: "name" } },
      { name: "pantry", label: "Pantry", kind: "truncate" },
      { name: "diet", label: "Diet" },
      { name: "is_active", label: "Active", kind: "bool" },
      { name: "updated_at", label: "Updated", kind: "date" },
    ],
  },
  models: {
    key: "models",
    table: "llm_models",
    title: "LLM models",
    singular: "model",
    icon: "🧠",
    description: "Models the prompt chain steps can call. Turning a model off removes every chain that uses it from the mix.",
    orderBy: "id",
    asc: true,
    search: ["display_name", "model_id"],
    deleteNote: "Models still used by a prompt chain step can't be deleted; deactivate them instead.",
    fields: [
      { name: "display_name", label: "Display name", type: "text", required: true, max: 80, placeholder: "Gemini 2.5 Flash" },
      { name: "provider_id", label: "Provider", type: "ref", required: true, ref: { table: "llm_providers", label: "name" } },
      { name: "model_id", label: "Model id", type: "text", required: true, max: 120, mono: true, placeholder: "google/gemini-2.5-flash", hint: "Exactly what the provider's API expects in the model field." },
      { name: "kind", label: "Kind", type: "select", required: true, options: [{ value: "text", label: "Text (recipe JSON)" }, { value: "image", label: "Image (dish photo)" }], defaultValue: "text" },
      { name: "temperature", label: "Temperature", type: "number", min: 0, max: 2, step: 0.05, nullable: true, hint: "0 to 2. Blank = provider default. Text models only." },
      { name: "max_tokens", label: "Max tokens", type: "number", min: 1, max: 32000, step: 1, nullable: true },
      { name: "input_cost_per_mtok", label: "Input $ / 1M tokens", type: "number", min: 0, max: 1000, step: 0.0001, defaultValue: 0, hint: "Used to estimate cost when the provider doesn't report it." },
      { name: "output_cost_per_mtok", label: "Output $ / 1M tokens", type: "number", min: 0, max: 1000, step: 0.0001, defaultValue: 0 },
      { name: "is_active", label: "Active", type: "checkbox", defaultValue: true },
    ],
    columns: [
      { name: "display_name", label: "Name" },
      { name: "model_id", label: "Model id", kind: "mono" },
      { name: "provider_id", label: "Provider", kind: "ref", ref: { table: "llm_providers", label: "name" } },
      { name: "kind", label: "Kind" },
      { name: "temperature", label: "Temp" },
      { name: "output_cost_per_mtok", label: "Out $/1M", kind: "money" },
      { name: "is_active", label: "Active", kind: "bool" },
    ],
  },
  providers: {
    key: "providers",
    table: "llm_providers",
    title: "LLM providers",
    singular: "provider",
    icon: "🔌",
    description: "OpenAI-compatible APIs. The key itself stays in Vercel env vars; we only store the variable's name.",
    orderBy: "id",
    asc: true,
    search: ["name", "slug", "base_url"],
    deleteNote: "Providers that still have models can't be deleted; delete or move the models first.",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, max: 60, placeholder: "OpenRouter" },
      { name: "slug", label: "Slug", type: "text", required: true, max: 40, transform: "slug", mono: true, pattern: { re: "^[a-z0-9-]{1,40}$", message: "Slug: lowercase letters, numbers and dashes." } },
      { name: "base_url", label: "Base URL", type: "text", required: true, max: 200, mono: true, placeholder: "https://openrouter.ai/api/v1", pattern: { re: "^https://", message: "Base URL must start with https://" }, hint: "We POST to {base URL}/chat/completions." },
      { name: "api_key_env", label: "API key env var", type: "text", required: true, max: 64, transform: "env", mono: true, placeholder: "OPENROUTER_API_KEY", pattern: { re: "^[A-Z][A-Z0-9_]{0,63}$", message: "Env var: uppercase letters, numbers and underscores." } },
      { name: "notes", label: "Notes", type: "textarea", max: 500, rows: 2 },
      { name: "is_active", label: "Active", type: "checkbox", defaultValue: true },
    ],
    columns: [
      { name: "name", label: "Name" },
      { name: "slug", label: "Slug", kind: "mono" },
      { name: "base_url", label: "Base URL", kind: "mono" },
      { name: "api_key_env", label: "Key env", kind: "mono" },
      { name: "is_active", label: "Active", kind: "bool" },
    ],
  },
  "signup-domains": {
    key: "signup-domains",
    table: "allowed_signup_domains",
    title: "Allowed signup domains",
    singular: "domain",
    icon: "🏫",
    description: "New Google accounts can sign up if their email is on one of these domains (subdomains count) or is whitelisted. Enforced by a trigger on auth.users. If both lists are empty, signups are open.",
    orderBy: "domain",
    asc: true,
    search: ["domain", "note"],
    fields: [
      { name: "domain", label: "Domain", type: "text", required: true, max: 120, transform: "domain", mono: true, placeholder: "columbia.edu", pattern: { re: "^[a-z0-9-]+(\\.[a-z0-9-]+)*\\.[a-z]{2,}$", message: "Enter a domain like columbia.edu (no @, no https://)." } },
      { name: "note", label: "Note", type: "text", max: 200 },
    ],
    columns: [
      { name: "domain", label: "Domain", kind: "mono" },
      { name: "note", label: "Note" },
      { name: "created_at", label: "Added", kind: "date" },
    ],
  },
  whitelist: {
    key: "whitelist",
    table: "whitelisted_emails",
    title: "Whitelisted emails",
    singular: "email",
    icon: "✉️",
    description: "Individual emails that may sign up even when their domain isn't allowed.",
    orderBy: "email",
    asc: true,
    search: ["email", "note"],
    fields: [
      { name: "email", label: "Email", type: "text", required: true, max: 254, transform: "lower", mono: true, placeholder: "friend@gmail.com", pattern: { re: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", message: "Enter a valid email address." } },
      { name: "note", label: "Note", type: "text", max: 200 },
    ],
    columns: [
      { name: "email", label: "Email", kind: "mono" },
      { name: "note", label: "Note" },
      { name: "created_at", label: "Added", kind: "date" },
    ],
  },
};

export function getResource(key: string): Resource {
  const r = RESOURCES[key];
  if (!r) throw new Error(`Unknown resource ${key}`);
  return r;
}

/** Turns a form submission into a row, or an error message. */
export function parseResourceForm(res: Resource, fd: FormData): Record<string, unknown> | string {
  const row: Record<string, unknown> = {};
  for (const f of res.fields) {
    if (f.type === "checkbox") {
      row[f.name] = fd.get(f.name) === "on";
      continue;
    }
    let v = String(fd.get(f.name) ?? "").trim();
    if (f.transform === "lower") v = v.toLowerCase();
    if (f.transform === "domain") v = v.toLowerCase().replace(/^https?:\/\//, "").replace(/^.*@/, "").replace(/\/.*$/, "");
    if (f.transform === "slug") v = v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (f.transform === "env") v = v.toUpperCase();

    if (!v) {
      if (f.required) return `${f.label} is required.`;
      row[f.name] = f.nullable || f.type === "ref" || f.type === "number" ? null : "";
      continue;
    }
    if (f.type === "number" || f.type === "ref") {
      const n = Number(v);
      if (!Number.isFinite(n)) return `${f.label} must be a number.`;
      if (f.type === "number" && ((f.min != null && n < f.min) || (f.max != null && n > f.max)))
        return `${f.label} must be between ${f.min} and ${f.max}.`;
      if (f.type === "number" && f.step === 1 && !Number.isInteger(n)) return `${f.label} must be a whole number.`;
      row[f.name] = n;
      continue;
    }
    if (f.type === "json") {
      try {
        const parsed = JSON.parse(v);
        if (typeof parsed !== "object" || parsed === null) return `${f.label} must be a JSON object.`;
        row[f.name] = parsed;
      } catch (e) {
        return `${f.label} is not valid JSON (${e instanceof Error ? e.message : "parse error"}).`;
      }
      continue;
    }
    if (f.max != null && v.length > f.max) return `${f.label} must be at most ${f.max} characters.`;
    if (f.min != null && v.length < f.min) return `${f.label} must be at least ${f.min} characters.`;
    if (f.pattern && !new RegExp(f.pattern.re).test(v)) return f.pattern.message;
    if (f.type === "select" && f.options && !f.options.some((o) => o.value === v)) return `Pick a valid ${f.label.toLowerCase()}.`;
    row[f.name] = v;
  }
  return row;
}

/** Friendly messages for the Postgres errors admins actually hit. */
export function explainDbError(res: Resource, err: { code?: string; message: string }) {
  if (err.code === "23505") return `That ${res.singular} already exists (duplicate value).`;
  if (err.code === "23503") return res.deleteNote ?? `This ${res.singular} is still referenced by other rows.`;
  if (err.code === "23514") return `A value failed a database check: ${err.message}`;
  if (err.code === "42501") return "Permission denied (are you still a superadmin?).";
  return err.message;
}
