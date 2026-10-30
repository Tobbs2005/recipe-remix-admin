# Recipe Remix Admin

Back-of-house admin panel for [Recipe Remix](https://github.com/Tobbs2005/nextjs-vercel-demo), the AI recipe app from the humor project. Same Supabase project, separate Next.js app and Vercel deployment.

## What it does

| Area | Route | Access |
| --- | --- | --- |
| Kitchen report (stats) | `/` | read |
| Users / profiles | `/users`, `/users/[id]` | **READ** |
| AI recipes + dish photos | `/recipes`, `/recipes/new`, `/recipes/[id]` | **CREATE / READ / UPDATE / DELETE** |
| AI-generated media (dish photos) | `/media` | **READ / VIEW** (upload, replace, remove via the recipe page) |
| Star ratings | `/ratings` | **READ** |
| Prompt chains + their steps | `/prompt-chains`, `/prompt-chains/[id]` | **READ** |
| Prompt chain mix (traffic weights) | `/mix` | **READ / UPDATE** |
| Terms (kitchen glossary fed into prompts) | `/terms` | **CREATE / READ / UPDATE / DELETE** |
| Generation examples (few-shot) | `/examples` | **CREATE / READ / UPDATE / DELETE** |
| LLM models | `/models` | **CREATE / READ / UPDATE / DELETE** |
| LLM providers | `/providers` | **CREATE / READ / UPDATE / DELETE** |
| Generation requests (+ stats) | `/requests`, `/requests/[id]` | **READ** |
| LLM responses (+ per-model latency/cost) | `/responses`, `/responses/[id]` | **READ** |
| Allowed signup domains | `/signup-domains` | **CREATE / READ / UPDATE / DELETE** |
| Whitelisted emails | `/whitelist` | **CREATE / READ / UPDATE / DELETE** |

### Week 7: config lives in the database, every call is logged

`supabase/migrations/0006_llm_observability.sql` adds providers, models, prompt chains/steps, the chain mix, terms, examples, generation requests, LLM responses and the signup allowlists. The generator (`src/lib/ai/pipeline.ts`, shared with the public app) picks a chain by weighted random from the mix, skips chains whose model or provider is switched off, fills `{{terms}}` and `{{examples}}` into the prompt, and logs one `generation_requests` row per click plus one `llm_responses` row per model call (prompts as sent, raw output, latency, tokens, cost). Signups are enforced by a `before insert` trigger on `auth.users`: allowed domain (subdomains count) or whitelisted email, open if both lists are empty.

The overview highlights: a day-of-week x hour "kitchen clock" heatmap, 30-day activity, the most common fridge ingredients and how their recipes rate, the star distribution, cook time vs. rating, diet split, the toughest and sweetest critics, top chefs, hall of fame, most divisive recipes (std. dev. of stars) and most saved.

Recipes can be created with the same AI pipeline as the public app (Gemini Flash text + Gemini Flash Image photo via OpenRouter) or written by hand. Edits can replace or remove the photo; deletes also remove the photo from storage (ratings and saves cascade).

## Security: three walls

1. **Proxy** (`src/proxy.ts`): every route except `/login`, `/auth/*` and `/denied` requires a Google session, then calls `is_superadmin()` in the database. Signed-out users go to `/login`, signed-in non-admins go to `/denied`.
2. **Server check** (`requireAdmin()`): every admin page, layout and Server Action re-checks `profiles.is_superadmin` before touching data.
3. **Postgres RLS** (`supabase/migrations/0005_admin_panel.sql`): even with the public anon key, only superadmins can read all profiles/ratings/favorites, delete recipes, call `admin_update_recipe`, or manage any file in the `recipe-images` bucket.

### "Won't the superadmin requirement lock me out?"

No, because the flag is never set through the app. `is_superadmin` defaults to `false`, and a trigger (`protect_superadmin_flag`) blocks any request made with a user JWT (anon or authenticated) from changing it, so nobody can promote themselves, admins included. The first admin is bootstrapped out-of-band from the **Supabase dashboard SQL editor**, which runs as the `postgres` role and bypasses RLS and that trigger:

```sql
update public.profiles set is_superadmin = true where email = 'you@example.com';
```

(Sign in once with Google first so the `profiles` row exists.) Promoting or demoting anyone later works the same way.

## Setup

1. Run `supabase/migrations/0005_admin_panel.sql` and `0006_llm_observability.sql` in the Supabase SQL editor (after the app's 0001 to 0004).
2. Copy `.env.example` to `.env.local` and fill in the same Supabase URL / anon key as the app (plus `OPENROUTER_API_KEY` for AI creation).
3. In Supabase Auth > URL Configuration, allow `http://localhost:3000/**` and your Vercel domains (`https://*-tobbs2005s-projects.vercel.app/**`).
4. `npm install && npm run dev`.

`supabase/seed/simulated_recipes.sql` adds 40 simulated recipes (generated with the real AI pipeline, photos in `recipe-images/seed/`), 313 ratings and 45 saves from the 24 simulated test accounts. `simulated_recipes_cleanup.sql` removes them.

Built with Next.js 16, Supabase (`@supabase/ssr`) and Tailwind CSS 4.
