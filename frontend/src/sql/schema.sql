-- =====================================================================
-- KitchenBase — Foundational Database Schema
-- =====================================================================
-- Paste this entire file into the Supabase SQL Editor and click "Run".
-- It is idempotent (uses IF NOT EXISTS) so it can be re-run safely.
--
-- All identifiers, comments, and constants are in English.
-- Spanish text only appears in seed examples shown in comments, never live.
-- =====================================================================

-- Required extensions ---------------------------------------------------
create extension if not exists "pgcrypto";

-- =====================================================================
-- GROUP A — GLOBAL CATALOG (admin-managed, read-only for users)
-- =====================================================================

-- 1) ingredient_categories ----------------------------------------------
create table if not exists public.ingredient_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  icon        text,
  sort_order  integer,
  created_at  timestamptz not null default now()
);

-- 2) units ---------------------------------------------------------------
create table if not exists public.units (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  symbol       text,
  unit_system  text not null check (unit_system in ('metric','culinary','imperial')),
  is_base      boolean not null default false
);

-- 3) ingredients ---------------------------------------------------------
create table if not exists public.ingredients (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null unique,
  category_id           uuid not null references public.ingredient_categories(id),
  base_unit             text not null check (base_unit in ('g','ml')),
  is_key_default        boolean not null,
  external_db_id        text,
  kcal_per_100          numeric(8,2),
  protein_per_100       numeric(8,2),
  carbs_per_100         numeric(8,2),
  fat_per_100           numeric(8,2),
  fiber_per_100         numeric(8,2),
  created_at            timestamptz not null default now(),
  created_by_admin_id   uuid
);
create index if not exists idx_ingredients_category on public.ingredients(category_id);

-- 4) unit_conversions ----------------------------------------------------
create table if not exists public.unit_conversions (
  id              uuid primary key default gen_random_uuid(),
  ingredient_id   uuid not null references public.ingredients(id) on delete cascade,
  unit_id         uuid not null references public.units(id),
  to_base_factor  numeric(10,6) not null,
  notes           text
);
create index if not exists idx_unit_conversions_ingredient on public.unit_conversions(ingredient_id);
create index if not exists idx_unit_conversions_unit on public.unit_conversions(unit_id);

-- 5) translations --------------------------------------------------------
create table if not exists public.translations (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null,
  record_id   uuid not null,
  field_name  text not null,
  language    text not null,
  value       text not null,
  constraint translations_unique_per_field unique (table_name, record_id, field_name, language)
);
create index if not exists idx_translations_lookup on public.translations(table_name, record_id, field_name, language);

-- =====================================================================
-- GROUP B — USER-CREATED INGREDIENTS IN QUARANTINE
-- =====================================================================

-- 6) user_ingredients ---------------------------------------------------
create table if not exists public.user_ingredients (
  id              uuid primary key default gen_random_uuid(),
  created_by      uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  base_unit       text not null check (base_unit in ('g','ml')),
  status          text not null default 'pending' check (status in ('pending','validated','rejected')),
  merged_into_id  uuid references public.ingredients(id),
  admin_notes     text,
  created_at      timestamptz not null default now(),
  reviewed_at     timestamptz
);
create index if not exists idx_user_ingredients_created_by on public.user_ingredients(created_by);
create index if not exists idx_user_ingredients_status on public.user_ingredients(status);

-- =====================================================================
-- GROUP C — RECIPES
-- =====================================================================

-- 7) recipes -------------------------------------------------------------
create table if not exists public.recipes (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  title                    text not null,
  difficulty               text not null check (difficulty in ('easy','medium','hard')),
  prep_time_minutes        integer,
  servings                 integer not null,
  status                   text not null default 'private' check (status in ('private','proposed','public')),
  has_pending_ingredients  boolean not null default false,
  kcal_per_serving         numeric(8,2),
  protein_per_serving      numeric(8,2),
  carbs_per_serving        numeric(8,2),
  fat_per_serving          numeric(8,2),
  fiber_per_serving        numeric(8,2),
  created_at               timestamptz not null default now(),
  published_at             timestamptz
);
create index if not exists idx_recipes_user on public.recipes(user_id);
create index if not exists idx_recipes_status on public.recipes(status);

-- 8) recipe_ingredients --------------------------------------------------
create table if not exists public.recipe_ingredients (
  id                  uuid primary key default gen_random_uuid(),
  recipe_id           uuid not null references public.recipes(id) on delete cascade,
  ingredient_id       uuid references public.ingredients(id),
  user_ingredient_id  uuid references public.user_ingredients(id),
  quantity            numeric(10,4) not null,
  unit_id             uuid not null references public.units(id),
  is_key              boolean not null,
  notes               text,
  sort_order          integer not null,
  constraint recipe_ingredients_one_source check (
    (ingredient_id is not null and user_ingredient_id is null)
    or
    (ingredient_id is null and user_ingredient_id is not null)
  )
);
create index if not exists idx_recipe_ingredients_recipe on public.recipe_ingredients(recipe_id);

-- 9) recipe_steps --------------------------------------------------------
create table if not exists public.recipe_steps (
  id           uuid primary key default gen_random_uuid(),
  recipe_id    uuid not null references public.recipes(id) on delete cascade,
  step_number  integer not null,
  instruction  text not null
);
create index if not exists idx_recipe_steps_recipe on public.recipe_steps(recipe_id);

-- =====================================================================
-- GROUP D — USER-PRIVATE DATA
-- =====================================================================

-- 10) pantry_items -------------------------------------------------------
create table if not exists public.pantry_items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  ingredient_id  uuid not null references public.ingredients(id),
  quantity       numeric(10,4),
  unit_id        uuid references public.units(id),
  location       text not null check (location in ('fridge','pantry','freezer')),
  is_basic       boolean not null default false,
  updated_at     timestamptz not null default now()
);
create index if not exists idx_pantry_items_user on public.pantry_items(user_id);

-- 11) library ------------------------------------------------------------
create table if not exists public.library (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  recipe_id  uuid not null references public.recipes(id) on delete cascade,
  added_at   timestamptz not null default now(),
  constraint library_user_recipe_unique unique (user_id, recipe_id)
);
create index if not exists idx_library_user on public.library(user_id);

-- 12) shopping_list_items ------------------------------------------------
create table if not exists public.shopping_list_items (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  ingredient_id          uuid not null references public.ingredients(id),
  needed_quantity        numeric(10,4) not null,
  is_checked             boolean not null default false,
  bought_quantity        numeric(10,4),
  added_from_recipe_id   uuid references public.recipes(id) on delete set null,
  added_at               timestamptz not null default now(),
  checked_at             timestamptz
);
create index if not exists idx_shopping_list_user on public.shopping_list_items(user_id);

-- 13) cooking_history ----------------------------------------------------
create table if not exists public.cooking_history (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  recipe_id      uuid not null references public.recipes(id) on delete cascade,
  servings_made  integer not null,
  cooked_at      timestamptz not null default now(),
  notes          text
);
create index if not exists idx_cooking_history_user on public.cooking_history(user_id);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

-- GROUP A — global catalog: read-only for authenticated, no client writes
alter table public.ingredient_categories enable row level security;
alter table public.units                  enable row level security;
alter table public.ingredients            enable row level security;
alter table public.unit_conversions       enable row level security;
alter table public.translations           enable row level security;

-- Drop existing policies (re-runnable)
drop policy if exists "catalog_categories_select"   on public.ingredient_categories;
drop policy if exists "catalog_units_select"        on public.units;
drop policy if exists "catalog_ingredients_select"  on public.ingredients;
drop policy if exists "catalog_unit_conv_select"    on public.unit_conversions;
drop policy if exists "catalog_translations_select" on public.translations;

create policy "catalog_categories_select"
  on public.ingredient_categories for select to authenticated using (true);

create policy "catalog_units_select"
  on public.units for select to authenticated using (true);

create policy "catalog_ingredients_select"
  on public.ingredients for select to authenticated using (true);

create policy "catalog_unit_conv_select"
  on public.unit_conversions for select to authenticated using (true);

create policy "catalog_translations_select"
  on public.translations for select to authenticated using (true);

-- GROUP B — user_ingredients
alter table public.user_ingredients enable row level security;

drop policy if exists "user_ingredients_select_own" on public.user_ingredients;
drop policy if exists "user_ingredients_insert_own" on public.user_ingredients;

create policy "user_ingredients_select_own"
  on public.user_ingredients for select to authenticated
  using (created_by = auth.uid());

create policy "user_ingredients_insert_own"
  on public.user_ingredients for insert to authenticated
  with check (created_by = auth.uid());

-- GROUP C — recipes & children
alter table public.recipes             enable row level security;
alter table public.recipe_ingredients  enable row level security;
alter table public.recipe_steps        enable row level security;

drop policy if exists "recipes_select_owner_or_public" on public.recipes;
drop policy if exists "recipes_insert_owner"           on public.recipes;
drop policy if exists "recipes_update_owner"           on public.recipes;
drop policy if exists "recipes_delete_owner"           on public.recipes;

create policy "recipes_select_owner_or_public"
  on public.recipes for select to authenticated
  using (user_id = auth.uid() or status = 'public');

create policy "recipes_insert_owner"
  on public.recipes for insert to authenticated
  with check (user_id = auth.uid());

create policy "recipes_update_owner"
  on public.recipes for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "recipes_delete_owner"
  on public.recipes for delete to authenticated
  using (user_id = auth.uid());

-- recipe_ingredients inherits via parent recipe
drop policy if exists "recipe_ingredients_select" on public.recipe_ingredients;
drop policy if exists "recipe_ingredients_insert" on public.recipe_ingredients;
drop policy if exists "recipe_ingredients_update" on public.recipe_ingredients;
drop policy if exists "recipe_ingredients_delete" on public.recipe_ingredients;

create policy "recipe_ingredients_select"
  on public.recipe_ingredients for select to authenticated
  using (exists (
    select 1 from public.recipes r
     where r.id = recipe_ingredients.recipe_id
       and (r.user_id = auth.uid() or r.status = 'public')
  ));

create policy "recipe_ingredients_insert"
  on public.recipe_ingredients for insert to authenticated
  with check (exists (
    select 1 from public.recipes r
     where r.id = recipe_ingredients.recipe_id and r.user_id = auth.uid()
  ));

create policy "recipe_ingredients_update"
  on public.recipe_ingredients for update to authenticated
  using (exists (
    select 1 from public.recipes r
     where r.id = recipe_ingredients.recipe_id and r.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.recipes r
     where r.id = recipe_ingredients.recipe_id and r.user_id = auth.uid()
  ));

create policy "recipe_ingredients_delete"
  on public.recipe_ingredients for delete to authenticated
  using (exists (
    select 1 from public.recipes r
     where r.id = recipe_ingredients.recipe_id and r.user_id = auth.uid()
  ));

-- recipe_steps inherits via parent recipe
drop policy if exists "recipe_steps_select" on public.recipe_steps;
drop policy if exists "recipe_steps_insert" on public.recipe_steps;
drop policy if exists "recipe_steps_update" on public.recipe_steps;
drop policy if exists "recipe_steps_delete" on public.recipe_steps;

create policy "recipe_steps_select"
  on public.recipe_steps for select to authenticated
  using (exists (
    select 1 from public.recipes r
     where r.id = recipe_steps.recipe_id
       and (r.user_id = auth.uid() or r.status = 'public')
  ));

create policy "recipe_steps_insert"
  on public.recipe_steps for insert to authenticated
  with check (exists (
    select 1 from public.recipes r
     where r.id = recipe_steps.recipe_id and r.user_id = auth.uid()
  ));

create policy "recipe_steps_update"
  on public.recipe_steps for update to authenticated
  using (exists (
    select 1 from public.recipes r
     where r.id = recipe_steps.recipe_id and r.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.recipes r
     where r.id = recipe_steps.recipe_id and r.user_id = auth.uid()
  ));

create policy "recipe_steps_delete"
  on public.recipe_steps for delete to authenticated
  using (exists (
    select 1 from public.recipes r
     where r.id = recipe_steps.recipe_id and r.user_id = auth.uid()
  ));

-- GROUP D — user-private tables: all operations restricted to user_id
alter table public.pantry_items         enable row level security;
alter table public.library              enable row level security;
alter table public.shopping_list_items  enable row level security;
alter table public.cooking_history      enable row level security;

-- pantry_items
drop policy if exists "pantry_items_all_owner" on public.pantry_items;
create policy "pantry_items_all_owner"
  on public.pantry_items for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- library
drop policy if exists "library_all_owner" on public.library;
create policy "library_all_owner"
  on public.library for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- shopping_list_items
drop policy if exists "shopping_list_items_all_owner" on public.shopping_list_items;
create policy "shopping_list_items_all_owner"
  on public.shopping_list_items for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- cooking_history
drop policy if exists "cooking_history_all_owner" on public.cooking_history;
create policy "cooking_history_all_owner"
  on public.cooking_history for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =====================================================================
-- DONE. Verify in Supabase Dashboard → Table Editor that all 14 tables
-- exist and RLS is enabled (shield icon next to each table name).
-- =====================================================================
