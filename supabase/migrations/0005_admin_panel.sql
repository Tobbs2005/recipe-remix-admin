-- Week 6: Admin panel. Superadmin flag + RLS so admins (and only admins) can
-- read every profile / rating and manage every recipe. Run in the Supabase
-- SQL editor after 0004. Safe to re-run.
--
-- Bootstrapping (the "won't I be locked out?" question): the flag can never be
-- set through the API. Only the Supabase SQL editor / service role (which
-- bypass RLS and the guard trigger below) can flip it, so the first admin is
-- promoted by hand at the bottom of this file.

------------------------------------------------------------------------------
-- 1. profiles.is_superadmin
------------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

-- Helper used by every admin policy. SECURITY DEFINER so it can read
-- profiles without recursing into profiles' own RLS policies.
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_superadmin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;
revoke all on function public.is_superadmin() from public, anon;
grant execute on function public.is_superadmin() to authenticated;

-- Guard: users (including admins) can never grant or remove the flag through
-- the API. Requests made with an anon/authenticated JWT are blocked; the SQL
-- editor and service role are not.
create or replace function public.protect_superadmin_flag()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.is_superadmin := false;
    elsif new.is_superadmin is distinct from old.is_superadmin then
      raise exception 'is_superadmin can only be changed from the Supabase dashboard'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_superadmin on public.profiles;
create trigger profiles_protect_superadmin
  before insert or update on public.profiles
  for each row execute function public.protect_superadmin_flag();

------------------------------------------------------------------------------
-- 2. READ users/profiles (admins see every profile)
------------------------------------------------------------------------------
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
  for select to authenticated using ((select public.is_superadmin()));

------------------------------------------------------------------------------
-- 3. CRUD AI-generated media (recipes + dish photos)
--    READ: recipes are already public. CREATE: admins insert as themselves
--    through the existing recipes_insert_own policy.
------------------------------------------------------------------------------
-- DELETE: there is no owner delete policy, so granting DELETE only helps admins.
grant delete on public.recipes to authenticated;
drop policy if exists "recipes_delete_admin" on public.recipes;
create policy "recipes_delete_admin" on public.recipes
  for delete to authenticated using ((select public.is_superadmin()));

-- UPDATE: owners may only touch image_path (column grant from 0003), so admin
-- edits go through a checked SECURITY DEFINER function instead of widening that grant.
create or replace function public.admin_update_recipe(
  p_id bigint,
  p_title text,
  p_description text,
  p_pantry text,
  p_diet text,
  p_ingredients jsonb,
  p_steps jsonb,
  p_minutes integer,
  p_servings integer,
  p_image_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_superadmin() then
    raise exception 'Only superadmins can edit recipes' using errcode = '42501';
  end if;
  update public.recipes set
    title = p_title,
    description = coalesce(p_description, ''),
    pantry = p_pantry,
    diet = p_diet,
    ingredients = coalesce(p_ingredients, '[]'::jsonb),
    steps = coalesce(p_steps, '[]'::jsonb),
    minutes = p_minutes,
    servings = p_servings,
    image_path = p_image_path
  where id = p_id;
  if not found then
    raise exception 'Recipe % not found', p_id using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.admin_update_recipe(bigint, text, text, text, text, jsonb, jsonb, integer, integer, text) from public, anon;
grant execute on function public.admin_update_recipe(bigint, text, text, text, text, jsonb, jsonb, integer, integer, text) to authenticated;

-- Dish photos: admins can read/replace/remove any file in the bucket.
drop policy if exists "recipe_images_admin_all" on storage.objects;
create policy "recipe_images_admin_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'recipe-images' and (select public.is_superadmin()))
  with check (bucket_id = 'recipe-images' and (select public.is_superadmin()));

------------------------------------------------------------------------------
-- 4. READ ratings (+ favorites for stats)
------------------------------------------------------------------------------
drop policy if exists "ratings_select_admin" on public.recipe_ratings;
create policy "ratings_select_admin" on public.recipe_ratings
  for select to authenticated using ((select public.is_superadmin()));

drop policy if exists "favorites_select_admin" on public.recipe_favorites;
create policy "favorites_select_admin" on public.recipe_favorites
  for select to authenticated using ((select public.is_superadmin()));

------------------------------------------------------------------------------
-- 5. Bootstrap the first superadmin (run from the SQL editor only).
------------------------------------------------------------------------------
update public.profiles set is_superadmin = true
where email in ('tobyfang05@gmail.com', 'zf2389@columbia.edu');
