-- Week 7: LLM config + observability for Recipe Remix.
-- Providers -> models -> prompt chains (steps) picked by a weighted mix,
-- cooking terms + few-shot examples injected into prompts, every generation
-- logged as a request with one llm_response per model call, and signups
-- gated by allowed domains / whitelisted emails.
-- Run in the Supabase SQL editor after 0005. Safe to re-run.

------------------------------------------------------------------------------
-- 1. LLM providers + models
------------------------------------------------------------------------------
create table if not exists public.llm_providers (
  id bigint generated always as identity primary key,
  name text not null unique check (char_length(name) between 1 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9-]{1,40}$'),
  base_url text not null check (base_url ~ '^https://'),   -- OpenAI-compatible /chat/completions root
  api_key_env text not null check (api_key_env ~ '^[A-Z][A-Z0-9_]{0,63}$'), -- env var name, never the key
  is_active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.llm_models (
  id bigint generated always as identity primary key,
  provider_id bigint not null references public.llm_providers (id) on delete restrict,
  model_id text not null check (char_length(model_id) between 1 and 120), -- e.g. google/gemini-2.5-flash
  display_name text not null check (char_length(display_name) between 1 and 80),
  kind text not null default 'text' check (kind in ('text', 'image')),
  temperature numeric(3,2) check (temperature between 0 and 2),
  max_tokens integer check (max_tokens between 1 and 32000),
  input_cost_per_mtok numeric(10,4) not null default 0,  -- USD per 1M input tokens (for cost estimates)
  output_cost_per_mtok numeric(10,4) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, model_id)
);
create index if not exists llm_models_provider_idx on public.llm_models (provider_id);

------------------------------------------------------------------------------
-- 2. Prompt chains, steps, mix
------------------------------------------------------------------------------
create table if not exists public.prompt_chains (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Step kinds: recipe_text (JSON recipe) then dish_image (photo).
-- Templates use {{pantry}} {{diet}} {{title}} {{image_prompt}} {{terms}} {{examples}}.
create table if not exists public.prompt_chain_steps (
  id bigint generated always as identity primary key,
  chain_id bigint not null references public.prompt_chains (id) on delete cascade,
  step_order integer not null check (step_order between 1 and 20),
  name text not null,
  kind text not null check (kind in ('recipe_text', 'dish_image')),
  model_id bigint not null references public.llm_models (id) on delete restrict,
  system_prompt text not null default '',
  user_prompt_template text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chain_id, step_order)
);
create index if not exists prompt_chain_steps_model_idx on public.prompt_chain_steps (model_id);

-- Share of new generations each chain gets (weighted random pick).
create table if not exists public.prompt_chain_mix (
  chain_id bigint primary key references public.prompt_chains (id) on delete cascade,
  weight integer not null default 0 check (weight between 0 and 100),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

------------------------------------------------------------------------------
-- 3. Terms (kitchen glossary) + generation examples (few-shot)
------------------------------------------------------------------------------
create table if not exists public.terms (
  id bigint generated always as identity primary key,
  term text not null unique check (char_length(term) between 1 and 60),
  definition text not null check (char_length(definition) between 1 and 500),
  category text not null default 'technique' check (char_length(category) between 1 and 40),
  include_in_prompt boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generation_examples (
  id bigint generated always as identity primary key,
  chain_id bigint references public.prompt_chains (id) on delete cascade, -- null = every chain
  label text not null check (char_length(label) between 1 and 80),
  pantry text not null check (char_length(pantry) between 2 and 300),
  diet text not null default 'any',
  output jsonb not null,               -- the ideal recipe JSON for that pantry
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists generation_examples_chain_idx on public.generation_examples (chain_id);

------------------------------------------------------------------------------
-- 4. Observability: generation requests + llm responses
------------------------------------------------------------------------------
create table if not exists public.generation_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null default 'app' check (source in ('app', 'admin')),
  chain_id bigint references public.prompt_chains (id) on delete set null,
  chain_name text,
  pantry text not null,
  diet text,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  error text,
  recipe_id bigint references public.recipes (id) on delete set null,
  total_latency_ms integer,
  total_tokens integer,
  total_cost numeric(12,6),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists generation_requests_created_idx on public.generation_requests (created_at desc);
create index if not exists generation_requests_user_idx on public.generation_requests (user_id, created_at desc);

create table if not exists public.llm_responses (
  id bigint generated always as identity primary key,
  request_id bigint not null references public.generation_requests (id) on delete cascade,
  step_id bigint references public.prompt_chain_steps (id) on delete set null,
  step_order integer not null,
  step_name text,
  kind text not null,
  model_id bigint references public.llm_models (id) on delete set null,
  model_name text not null,          -- what we asked for
  served_model text,                 -- what the provider says answered
  system_prompt text not null default '',
  user_prompt text not null,
  response_text text,                -- raw text (images are summarized, never base64)
  status text not null check (status in ('ok', 'error')),
  http_status integer,
  error text,
  latency_ms integer,
  prompt_tokens integer,
  completion_tokens integer,
  cost numeric(12,6),
  created_at timestamptz not null default now()
);
create index if not exists llm_responses_request_idx on public.llm_responses (request_id);
create index if not exists llm_responses_created_idx on public.llm_responses (created_at desc);

------------------------------------------------------------------------------
-- 5. Signup gate: allowed domains + whitelisted emails
------------------------------------------------------------------------------
create table if not exists public.allowed_signup_domains (
  id bigint generated always as identity primary key,
  domain text not null unique check (domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$'),
  note text not null default '',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whitelisted_emails (
  id bigint generated always as identity primary key,
  email text not null unique check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  note text not null default '',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- True when the email may sign up: whitelisted, on an allowed domain (or a
-- subdomain of one), or both lists are empty (open signups).
create or replace function public.signup_allowed(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (not exists (select 1 from public.allowed_signup_domains)
       and not exists (select 1 from public.whitelisted_emails))
    or exists (select 1 from public.whitelisted_emails w where w.email = lower(p_email))
    or exists (
      select 1 from public.allowed_signup_domains d
      where lower(split_part(p_email, '@', 2)) = d.domain
         or lower(split_part(p_email, '@', 2)) like '%.' || d.domain
    );
$$;
revoke all on function public.signup_allowed(text) from public;
grant execute on function public.signup_allowed(text) to anon, authenticated;

-- Enforced in the database: Supabase Auth inserts new users as
-- supabase_auth_admin, so the trigger blocks those. Rows added from the SQL
-- editor (e.g. simulated test accounts) are not affected.
create or replace function public.enforce_signup_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if session_user = 'supabase_auth_admin' and not public.signup_allowed(coalesce(new.email, '')) then
    raise exception 'Signups are limited to approved schools and invited emails'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_signup_allowlist on auth.users;
create trigger on_auth_user_signup_allowlist
  before insert on auth.users
  for each row execute function public.enforce_signup_allowlist();

------------------------------------------------------------------------------
-- 6. updated_at triggers
------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['llm_providers','llm_models','prompt_chains','prompt_chain_steps',
                           'terms','generation_examples','allowed_signup_domains','whitelisted_emails']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_set_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
                   t || '_set_updated_at', t);
  end loop;
end $$;

drop trigger if exists prompt_chain_mix_set_updated_at on public.prompt_chain_mix;
create trigger prompt_chain_mix_set_updated_at
  before update on public.prompt_chain_mix
  for each row execute function public.set_updated_at();

------------------------------------------------------------------------------
-- 7. Row Level Security
------------------------------------------------------------------------------
-- Config tables: any signed-in user can read (the generator needs them),
-- only superadmins can write.
do $$
declare t text;
begin
  foreach t in array array['llm_providers','llm_models','prompt_chains','prompt_chain_steps',
                           'prompt_chain_mix','terms','generation_examples']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('drop policy if exists %I on public.%I', t || '_select_auth', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_select_auth', t);
    execute format('drop policy if exists %I on public.%I', t || '_write_admin', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select public.is_superadmin())) with check ((select public.is_superadmin()))',
                   t || '_write_admin', t);
  end loop;
end $$;

-- Signup lists: superadmins only.
do $$
declare t text;
begin
  foreach t in array array['allowed_signup_domains','whitelisted_emails']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select public.is_superadmin())) with check ((select public.is_superadmin()))',
                   t || '_admin_all', t);
  end loop;
end $$;

-- Logs: users write and read their own; superadmins read everything.
-- Nobody deletes through the API.
alter table public.generation_requests enable row level security;
revoke all on public.generation_requests from anon;
revoke delete on public.generation_requests from authenticated;
drop policy if exists "gen_requests_select" on public.generation_requests;
create policy "gen_requests_select" on public.generation_requests
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_superadmin()));
drop policy if exists "gen_requests_insert_own" on public.generation_requests;
create policy "gen_requests_insert_own" on public.generation_requests
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "gen_requests_update_own" on public.generation_requests;
create policy "gen_requests_update_own" on public.generation_requests
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table public.llm_responses enable row level security;
revoke all on public.llm_responses from anon;
revoke update, delete on public.llm_responses from authenticated;
drop policy if exists "llm_responses_select" on public.llm_responses;
create policy "llm_responses_select" on public.llm_responses
  for select to authenticated using (
    (select public.is_superadmin())
    or exists (select 1 from public.generation_requests r where r.id = request_id and r.user_id = (select auth.uid()))
  );
drop policy if exists "llm_responses_insert_own" on public.llm_responses;
create policy "llm_responses_insert_own" on public.llm_responses
  for insert to authenticated with check (
    exists (select 1 from public.generation_requests r where r.id = request_id and r.user_id = (select auth.uid()))
  );

------------------------------------------------------------------------------
-- 8. Seed data (matches what the app used to hard-code)
------------------------------------------------------------------------------
insert into public.llm_providers (name, slug, base_url, api_key_env, is_active, notes) values
  ('OpenRouter', 'openrouter', 'https://openrouter.ai/api/v1', 'OPENROUTER_API_KEY', true, 'One key, many models. Default provider.'),
  ('OpenAI', 'openai', 'https://api.openai.com/v1', 'OPENAI_API_KEY', false, 'Direct OpenAI. Off until OPENAI_API_KEY is set on Vercel.')
on conflict (slug) do nothing;

insert into public.llm_models (provider_id, model_id, display_name, kind, temperature, max_tokens, input_cost_per_mtok, output_cost_per_mtok, is_active)
select p.id, m.model_id, m.display_name, m.kind, m.temperature, m.max_tokens, m.inp, m.outp, m.active
from public.llm_providers p
join (values
  ('google/gemini-2.5-flash',       'Gemini 2.5 Flash',       'text',  0.90::numeric, 1500, 0.30::numeric, 2.50::numeric, true),
  ('openai/gpt-4o-mini',            'GPT-4o mini',            'text',  0.90::numeric, 1500, 0.15::numeric, 0.60::numeric, true),
  ('google/gemini-2.5-flash-image', 'Gemini 2.5 Flash Image', 'image', null::numeric, null, 0.30::numeric, 30.00::numeric, true)
) as m(model_id, display_name, kind, temperature, max_tokens, inp, outp, active) on true
where p.slug = 'openrouter'
on conflict (provider_id, model_id) do nothing;

insert into public.prompt_chains (slug, name, description) values
  ('classic-home-cook', 'Classic home cook', 'The original Recipe Remix pipeline: one balanced recipe, then a bright overhead dish photo.'),
  ('dorm-hacker', 'Dorm-room hacker', 'One pan or microwave, few dishes, playful names, cozy desk-lamp photo.')
on conflict (slug) do nothing;

insert into public.prompt_chain_mix (chain_id, weight)
select id, case slug when 'classic-home-cook' then 70 else 30 end from public.prompt_chains
on conflict (chain_id) do nothing;

insert into public.prompt_chain_steps (chain_id, step_order, name, kind, model_id, system_prompt, user_prompt_template)
select c.id, s.step_order, s.name, s.kind, m.id, s.system_prompt, s.tmpl
from public.prompt_chains c
join (values
  ('classic-home-cook', 1, 'Write the recipe', 'recipe_text', 'google/gemini-2.5-flash',
$p$You are a home cook who turns whatever is in someone's fridge into one great recipe.
Rules:
- Use mostly the ingredients given. You may assume pantry basics (salt, pepper, oil, water, common spices) and add at most 2 extra ingredients.
- Keep it realistic for a college student: under 60 minutes, common equipment.
- Respect the dietary preference strictly.
- Steps are short and imperative, 4 to 8 of them.
- Respond with JSON only:
{"title":"...","description":"one appetizing sentence","minutes":25,"servings":2,
 "ingredients":[{"item":"...","amount":"..."}],"steps":["..."],
 "image_prompt":"a short visual description of the finished plated dish"}

{{terms}}

{{examples}}$p$,
   E'Ingredients I have: {{pantry}}\nDietary preference: {{diet}}'),
  ('classic-home-cook', 2, 'Photograph the dish', 'dish_image', 'google/gemini-2.5-flash-image', '',
   'Appetizing overhead food photo of {{title}}: {{image_prompt}}. Natural light, home kitchen, on a simple plate, no text, no people.'),
  ('dorm-hacker', 1, 'Write the dorm recipe', 'recipe_text', 'google/gemini-2.5-flash',
$p$You are a resourceful college student cooking in a dorm with a microwave, a kettle and one pan.
Rules:
- Use mostly the ingredients given. Assume only salt, pepper, oil and water; add at most 1 extra ingredient.
- One pan, one bowl, or the microwave. Under 30 minutes. Minimal dishes.
- Give it a fun, catchy name.
- Respect the dietary preference strictly.
- 4 to 6 short imperative steps.
- Respond with JSON only:
{"title":"...","description":"one appetizing sentence","minutes":15,"servings":1,
 "ingredients":[{"item":"...","amount":"..."}],"steps":["..."],
 "image_prompt":"a short visual description of the finished dish"}

{{terms}}

{{examples}}$p$,
   E'Ingredients I have: {{pantry}}\nDietary preference: {{diet}}'),
  ('dorm-hacker', 2, 'Photograph the dorm dish', 'dish_image', 'google/gemini-2.5-flash-image', '',
   'Cozy food photo of {{title}} on a dorm desk: {{image_prompt}}. Warm desk-lamp light, a single bowl or mug, no text, no people.')
) as s(chain_slug, step_order, name, kind, model, system_prompt, tmpl) on s.chain_slug = c.slug
join public.llm_models m on m.model_id = s.model
join public.llm_providers p on p.id = m.provider_id and p.slug = 'openrouter'
on conflict (chain_id, step_order) do nothing;

insert into public.terms (term, definition, category) values
  ('Mise en place', 'Prep and measure every ingredient before turning on the heat.', 'technique'),
  ('Deglaze', 'Splash liquid into a hot pan to lift the browned bits into a sauce.', 'technique'),
  ('Fond', 'The browned bits stuck to the pan after searing; pure flavor.', 'technique'),
  ('Blanch', 'Boil briefly, then plunge into cold water to keep color and crunch.', 'technique'),
  ('Al dente', 'Pasta or veg cooked until tender with a slight bite in the center.', 'doneness'),
  ('Bloom', 'Toast spices in hot oil for 30 seconds to wake up their flavor.', 'technique'),
  ('Rest', 'Let cooked meat sit a few minutes so juices settle before cutting.', 'technique'),
  ('Sweat', 'Cook vegetables gently over low heat until soft but not browned.', 'technique')
on conflict (term) do nothing;

insert into public.generation_examples (chain_id, label, pantry, diet, output)
select null, 'Fried rice from leftovers', 'leftover rice, eggs, frozen peas, soy sauce, scallions', 'any',
  '{"title":"Weeknight Egg Fried Rice","description":"Crispy-edged rice tossed with soft egg, sweet peas and scallions.","minutes":15,"servings":2,"ingredients":[{"item":"cold cooked rice","amount":"2 cups"},{"item":"eggs","amount":"2"},{"item":"frozen peas","amount":"1/2 cup"},{"item":"soy sauce","amount":"1.5 tbsp"},{"item":"scallions, sliced","amount":"2"}],"steps":["Heat oil in a large pan over high heat.","Scramble the eggs until just set, then push to the side.","Add rice and press it flat; let it crisp for 2 minutes.","Stir in peas and soy sauce and toss for 2 minutes.","Fold in the eggs and scallions and serve hot."],"image_prompt":"golden fried rice with peas and scallions in a white bowl"}'::jsonb
where not exists (select 1 from public.generation_examples where label = 'Fried rice from leftovers');

insert into public.generation_examples (chain_id, label, pantry, diet, output)
select c.id, 'Microwave mug omelet', 'eggs, cheddar, spinach, milk', 'vegetarian',
  '{"title":"Mighty Mug Omelet","description":"A fluffy cheesy omelet cooked in a mug in two minutes.","minutes":5,"servings":1,"ingredients":[{"item":"eggs","amount":"2"},{"item":"milk","amount":"2 tbsp"},{"item":"cheddar, grated","amount":"1/4 cup"},{"item":"spinach, chopped","amount":"1 handful"}],"steps":["Whisk eggs and milk in a greased mug.","Stir in spinach and most of the cheese.","Microwave 45 seconds, stir, then 45 seconds more.","Top with the rest of the cheese and eat from the mug."],"image_prompt":"puffy omelet rising out of a ceramic mug with melted cheddar"}'::jsonb
from public.prompt_chains c
where c.slug = 'dorm-hacker'
  and not exists (select 1 from public.generation_examples where label = 'Microwave mug omelet');

-- Signup gate starts with Columbia + Barnard and the admin's own emails.
insert into public.allowed_signup_domains (domain, note) values
  ('columbia.edu', 'Columbia students, TAs and staff'),
  ('barnard.edu', 'Barnard students')
on conflict (domain) do nothing;
insert into public.whitelisted_emails (email, note) values
  ('tobyfang05@gmail.com', 'Owner (personal Google account)')
on conflict (email) do nothing;
