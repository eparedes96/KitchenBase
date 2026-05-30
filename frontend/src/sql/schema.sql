-- =====================================================================
-- KitchenBase — schema.sql
-- LIVE-DATABASE SNAPSHOT (not the original foundational schema)
-- =====================================================================
--
-- This file is a faithful snapshot of the live Supabase database state
-- (project ldrxurbtrbjhxmrpdtjr) as of 2026-05-30, after the cumulative
-- application of migrations 001 through 010 stored under
-- frontend/src/sql/migrations/. It is intended as the authoritative
-- blueprint for handoff and for reconstructing the schema on an empty
-- Supabase project.
--
-- IMPORTANT: this is NOT the original foundational schema that previously
-- lived in this file. It reflects every additive change up to and
-- including:
--   * 005  pantry quarantine support (user_ingredients table, XOR FKs)
--   * 006  semáforo engine (kb_* + compute_* functions)
--   * 007  quarantine duplicate guard (trigger on user_ingredients)
--   * 008  kb_base_unit_id helper + canonical unit_id comparison
--   * 009  units.dimension + ingredients.default_unit_id (D-033)
--   * 010  count units catalog + seed conversions (D-034)
--
-- Conventions
--   * English everywhere (SQL, identifiers, comments).
--   * UUID identifiers via gen_random_uuid().
--   * Timestamps stored as `timestamp with time zone` (timestamptz).
--   * RLS is ENABLED on every table in `public`. Catalog tables expose
--     SELECT to `authenticated`; user-owned tables scope every CRUD by
--     `auth.uid()`.
--
-- Order
--   1) Required extensions
--   2) Tables (FK-dependency order)
--   3) Indexes
--   4) Engine functions (kb_* helpers, then compute_*)
--   5) Trigger functions + triggers
--   6) RLS enablement + policies
--
-- Idempotency
--   Re-runnable where reasonable: `create table if not exists`,
--   `create or replace function`, `drop policy if exists` before
--   `create policy`, `drop trigger if exists` before `create trigger`.
--
-- NOTE: a function `rls_auto_enable()` also exists in the live `public`
-- schema. It is Supabase-managed and tied to a platform-level event
-- trigger that auto-enables RLS on newly-created tables. It is NOT
-- reproduced here because applying this snapshot to a fresh Supabase
-- project would either conflict with the platform's own copy or attempt
-- to register an event trigger without superuser rights. The function
-- is part of the Supabase environment, not part of this application.


-- =====================================================================
-- 1) EXTENSIONS
-- =====================================================================
-- Both extensions are placed in the `extensions` schema, matching
-- Supabase convention. `plpgsql` is a built-in language and is not
-- declared. `supabase_vault` is Supabase-managed and not declared here.
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto   with schema extensions;


-- =====================================================================
-- 2) TABLES (ordered by foreign-key dependency)
-- =====================================================================

-- ---- ingredient_categories ------------------------------------------
create table if not exists public.ingredient_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  icon        text,
  sort_order  integer,
  created_at  timestamptz not null default now()
);


-- ---- units -----------------------------------------------------------
-- Catalog of measurement units. `is_base = true` rows are the canonical
-- base units (gramo, mililitro) used by the semáforo engine.
-- `dimension` ('mass'/'volume', NULL for count/imprecise units like
-- 'unidad' or 'pizca') was added by migration 009 (D-033) so the engine
-- can resolve the canonical base unit without depending on free-text
-- `symbol` values.
create table if not exists public.units (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  symbol       text,
  unit_system  text not null check (unit_system in ('metric','culinary','imperial')),
  is_base      boolean not null default false,
  dimension    text check (dimension in ('mass','volume'))
);


-- ---- ingredients -----------------------------------------------------
-- `default_unit_id` (added by migration 009) is nullable and references
-- the unit the admin UI preselects when stocking this ingredient.
create table if not exists public.ingredients (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null unique,
  category_id         uuid not null references public.ingredient_categories(id),
  base_unit           text not null check (base_unit in ('g','ml')),
  is_key_default      boolean not null,
  external_db_id      text,
  kcal_per_100        numeric(8,2),
  protein_per_100     numeric(8,2),
  carbs_per_100       numeric(8,2),
  fat_per_100         numeric(8,2),
  fiber_per_100       numeric(8,2),
  created_at          timestamptz not null default now(),
  created_by_admin_id uuid,
  default_unit_id     uuid references public.units(id) on delete set null
);
create index if not exists idx_ingredients_category
  on public.ingredients (category_id);


-- ---- user_ingredients ------------------------------------------------
-- Quarantine ingredients proposed by users (D-005). They flow through a
-- pending -> validated/rejected lifecycle managed by admins. `merged_into_id`
-- records the catalog target when an admin merges a quarantine row into
-- the global catalog.
create table if not exists public.user_ingredients (
  id              uuid primary key default gen_random_uuid(),
  created_by      uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  base_unit       text not null check (base_unit in ('g','ml')),
  status          text not null default 'pending'
                    check (status in ('pending','validated','rejected')),
  merged_into_id  uuid references public.ingredients(id),
  admin_notes     text,
  created_at      timestamptz not null default now(),
  reviewed_at     timestamptz
);
create index if not exists idx_user_ingredients_created_by
  on public.user_ingredients (created_by);
create index if not exists idx_user_ingredients_status
  on public.user_ingredients (status);


-- ---- recipes ---------------------------------------------------------
create table if not exists public.recipes (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references auth.users(id) on delete cascade,
  title                      text not null,
  difficulty                 text not null check (difficulty in ('easy','medium','hard')),
  prep_time_minutes          integer,
  servings                   integer not null,
  status                     text not null default 'private'
                               check (status in ('private','proposed','public')),
  has_pending_ingredients    boolean not null default false,
  kcal_per_serving           numeric(8,2),
  protein_per_serving        numeric(8,2),
  carbs_per_serving          numeric(8,2),
  fat_per_serving            numeric(8,2),
  fiber_per_serving          numeric(8,2),
  created_at                 timestamptz not null default now(),
  published_at               timestamptz,
  is_draft                   boolean not null default false,
  draft_step                 integer
);
create index if not exists idx_recipes_user        on public.recipes (user_id);
create index if not exists idx_recipes_status      on public.recipes (status);
create index if not exists idx_recipes_user_draft  on public.recipes (user_id, is_draft);


-- ---- recipe_ingredients ---------------------------------------------
-- XOR (ingredient_id, user_ingredient_id): exactly one must be set.
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
  constraint recipe_ingredients_one_source
    check (
      (ingredient_id is not null and user_ingredient_id is null)
      or
      (ingredient_id is null and user_ingredient_id is not null)
    )
);
create index if not exists idx_recipe_ingredients_recipe
  on public.recipe_ingredients (recipe_id);


-- ---- recipe_steps ---------------------------------------------------
create table if not exists public.recipe_steps (
  id           uuid primary key default gen_random_uuid(),
  recipe_id    uuid not null references public.recipes(id) on delete cascade,
  step_number  integer not null,
  instruction  text not null
);
create index if not exists idx_recipe_steps_recipe
  on public.recipe_steps (recipe_id);


-- ---- pantry_items ---------------------------------------------------
-- `quantity` and `unit_id` are nullable because `is_basic=true` rows
-- legitimately have no quantity (basics count as always-available).
-- XOR (ingredient_id, user_ingredient_id).
create table if not exists public.pantry_items (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  ingredient_id       uuid references public.ingredients(id),
  user_ingredient_id  uuid references public.user_ingredients(id) on delete cascade,
  quantity            numeric(10,4),
  unit_id             uuid references public.units(id),
  location            text not null check (location in ('fridge','pantry','freezer')),
  is_basic            boolean not null default false,
  updated_at          timestamptz not null default now(),
  constraint pantry_items_one_source
    check (
      (ingredient_id is not null and user_ingredient_id is null)
      or
      (ingredient_id is null and user_ingredient_id is not null)
    )
);
create index if not exists idx_pantry_items_user
  on public.pantry_items (user_id);
-- Partial index: only rows that actually carry a quarantine reference.
create index if not exists idx_pantry_items_user_ingredient
  on public.pantry_items (user_ingredient_id)
  where (user_ingredient_id is not null);


-- ---- library ---------------------------------------------------------
create table if not exists public.library (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  recipe_id  uuid not null references public.recipes(id) on delete cascade,
  added_at   timestamptz not null default now(),
  constraint library_user_recipe_unique unique (user_id, recipe_id)
);
create index if not exists idx_library_user
  on public.library (user_id);


-- ---- shopping_list_items --------------------------------------------
-- Catalog-only: `ingredient_id` is NOT NULL. Quarantine ingredients
-- cannot live on the shopping list (D-027 / P5).
create table if not exists public.shopping_list_items (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  ingredient_id         uuid not null references public.ingredients(id),
  needed_quantity       numeric(10,4) not null,
  is_checked            boolean not null default false,
  bought_quantity       numeric(10,4),
  added_from_recipe_id  uuid references public.recipes(id) on delete set null,
  added_at              timestamptz not null default now(),
  checked_at            timestamptz
);
create index if not exists idx_shopping_list_user
  on public.shopping_list_items (user_id);


-- ---- cooking_history ------------------------------------------------
create table if not exists public.cooking_history (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  recipe_id      uuid not null references public.recipes(id) on delete cascade,
  servings_made  integer not null,
  cooked_at      timestamptz not null default now(),
  notes          text
);
create index if not exists idx_cooking_history_user
  on public.cooking_history (user_id);


-- ---- unit_conversions ------------------------------------------------
-- Per-ingredient factor toward the ingredient's base unit (g or ml).
-- Required for non-base units (kg, l) and for piece-counted units
-- ('unidad', 'diente') per D-034 — the factor varies per ingredient,
-- e.g. (Ajo, diente) = 5 g, (Huevo, unidad) = 60 g, etc.
create table if not exists public.unit_conversions (
  id              uuid primary key default gen_random_uuid(),
  ingredient_id   uuid not null references public.ingredients(id) on delete cascade,
  unit_id         uuid not null references public.units(id),
  to_base_factor  numeric(10,6) not null,
  notes           text
);
create index if not exists idx_unit_conversions_ingredient
  on public.unit_conversions (ingredient_id);
create index if not exists idx_unit_conversions_unit
  on public.unit_conversions (unit_id);


-- ---- translations ----------------------------------------------------
-- Generic i18n table: one row per (table_name, record_id, field_name,
-- language). Currently empty in production; reproduced as it is part of
-- the foundational schema.
create table if not exists public.translations (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null,
  record_id   uuid not null,
  field_name  text not null,
  language    text not null,
  value       text not null,
  constraint translations_unique_per_field
    unique (table_name, record_id, field_name, language)
);
create index if not exists idx_translations_lookup
  on public.translations (table_name, record_id, field_name, language);


-- =====================================================================
-- 3) ENGINE FUNCTIONS (kb_* helpers + compute_*)
-- =====================================================================
-- Bodies reproduced verbatim from pg_get_functiondef on the live DB.
-- Ordered so each definition's dependencies are already in place.

-- ---- kb_base_unit_id -------------------------------------------------
-- D-033: resolve the canonical base unit by (is_base, dimension). Never
-- by free-text symbol. Returns null if the requested dimension cannot be
-- matched.
create or replace function public.kb_base_unit_id(p_base_unit text)
returns uuid
language sql
stable
set search_path = public
as $function$
  SELECT u.id
  FROM public.units u
  WHERE u.is_base = TRUE
    AND u.dimension = CASE
      WHEN p_base_unit = 'g'  THEN 'mass'
      WHEN p_base_unit = 'ml' THEN 'volume'
      ELSE NULL
    END
  LIMIT 1;
$function$;


-- ---- kb_convert_to_base ---------------------------------------------
-- Convert a quantity expressed in `p_unit_id` to the ingredient's base
-- unit (g or ml). Returns null if no conversion path exists.
create or replace function public.kb_convert_to_base(
  p_ingredient_id uuid,
  p_quantity      numeric,
  p_unit_id       uuid
)
returns numeric
language plpgsql
stable
set search_path = public
as $function$
declare
  v_base_unit    text;
  v_base_unit_id uuid;
  v_factor       numeric;
begin
  select base_unit into v_base_unit
  from public.ingredients
  where id = p_ingredient_id;

  if v_base_unit is null then
    return null;
  end if;

  -- Canonical: resolve the ingredient's base unit ('g'/'ml') to its
  -- catalog row (is_base = true) and compare by unit_id, NOT by
  -- free-text symbol. (D-032)
  v_base_unit_id := public.kb_base_unit_id(v_base_unit);

  if v_base_unit_id is not null and p_unit_id = v_base_unit_id then
    return p_quantity;
  end if;

  select to_base_factor into v_factor
  from public.unit_conversions
  where ingredient_id = p_ingredient_id
    and unit_id = p_unit_id;

  if v_factor is null then
    return null;
  end if;

  return p_quantity * v_factor;
end$function$;


-- ---- kb_find_pantry_match -------------------------------------------
-- Return the user's pantry row (if any) for a given catalog ingredient
-- or quarantine ingredient. Caller MUST guard for `not found` before
-- reading the returned fields.
create or replace function public.kb_find_pantry_match(
  p_user_id            uuid,
  p_ingredient_id      uuid,
  p_user_ingredient_id uuid
)
returns table (
  pantry_id       uuid,
  pantry_quantity numeric,
  pantry_unit_id  uuid,
  is_basic        boolean
)
language plpgsql
stable
set search_path = public
as $function$
begin
  if p_ingredient_id is not null then
    return query
      select pi.id, pi.quantity, pi.unit_id, pi.is_basic
      from public.pantry_items pi
      where pi.user_id = p_user_id and pi.ingredient_id = p_ingredient_id
      limit 1;
  elsif p_user_ingredient_id is not null then
    return query
      select pi.id, pi.quantity, pi.unit_id, pi.is_basic
      from public.pantry_items pi
      where pi.user_id = p_user_id and pi.user_ingredient_id = p_user_ingredient_id
      limit 1;
  end if;
end$function$;


-- ---- compute_recipe_status ------------------------------------------
-- Per-recipe semáforo computation. Returns one row with status
-- ('green' | 'yellow' | 'orange') and a JSONB array of missing-ingredient
-- entries (one per missing recipe ingredient, with name, is_key,
-- is_pending, missing_quantity in base unit, and a reason code).
create or replace function public.compute_recipe_status(
  p_recipe_id uuid,
  p_user_id   uuid
)
returns table (
  status              text,
  missing_ingredients jsonb
)
language plpgsql
stable
set search_path = public
as $function$
declare
  v_ri record;
  v_pantry record;
  v_required_base numeric;
  v_available_base numeric;
  v_missing_quantity numeric;
  v_has_missing_key boolean := false;
  v_has_missing_any boolean := false;
  v_missing jsonb := '[]'::jsonb;
  v_ingredient_name text;
  v_base_unit text;
  v_base_unit_id uuid;
begin
  for v_ri in
    select ri.id as ri_id,
           ri.ingredient_id,
           ri.user_ingredient_id,
           ri.quantity as ri_quantity,
           ri.unit_id as ri_unit_id,
           ri.is_key
    from public.recipe_ingredients ri
    where ri.recipe_id = p_recipe_id
  loop
    -- Resolve ingredient display name + base unit (catalog or quarantine).
    if v_ri.ingredient_id is not null then
      select i.name, i.base_unit
        into v_ingredient_name, v_base_unit
      from public.ingredients i
      where i.id = v_ri.ingredient_id;
    else
      select ui.name, ui.base_unit
        into v_ingredient_name, v_base_unit
      from public.user_ingredients ui
      where ui.id = v_ri.user_ingredient_id;
    end if;

    -- Canonical base unit_id for this ingredient's base unit ('g'/'ml').
    -- The only `symbol` lookup in the whole engine. (D-032)
    v_base_unit_id := public.kb_base_unit_id(v_base_unit);

    select * into v_pantry
    from public.kb_find_pantry_match(p_user_id, v_ri.ingredient_id, v_ri.user_ingredient_id);

    -- Explicit not-found handling: no pantry row -> missing ingredient.
    -- Prevents reading null fields from `v_pantry` later in the body.
    if not found or v_pantry.pantry_id is null then
      v_has_missing_any := true;
      if v_ri.is_key then
        v_has_missing_key := true;
      end if;
      v_missing := v_missing || jsonb_build_object(
        'ingredient_id', v_ri.ingredient_id,
        'user_ingredient_id', v_ri.user_ingredient_id,
        'name', v_ingredient_name,
        'is_key', v_ri.is_key,
        'is_pending', (v_ri.user_ingredient_id is not null),
        'base_unit', v_base_unit,
        'missing_quantity', null,
        'reason', 'not_in_pantry'
      );
      continue;
    end if;

    -- Basic ingredients (is_basic=true) count as always available, no
    -- quantity check.
    if v_pantry.is_basic = true then
      continue;
    end if;

    -- Compute required vs available, both expressed in the ingredient's
    -- base unit.
    if v_ri.ingredient_id is not null then
      v_required_base  := public.kb_convert_to_base(v_ri.ingredient_id, v_ri.ri_quantity, v_ri.ri_unit_id);
      v_available_base := public.kb_convert_to_base(v_ri.ingredient_id, v_pantry.pantry_quantity, v_pantry.pantry_unit_id);
    else
      -- Quarantine ingredients have no rows in `unit_conversions`. The
      -- only comparison the engine can make is when the recipe unit IS
      -- the base unit. Decided canonically by unit_id, not symbol. (D-032)
      if v_base_unit_id is not null and v_ri.ri_unit_id = v_base_unit_id then
        v_required_base := v_ri.ri_quantity;
      else
        v_required_base := null;
      end if;

      if v_base_unit_id is not null and v_pantry.pantry_unit_id = v_base_unit_id then
        v_available_base := v_pantry.pantry_quantity;
      else
        v_available_base := null;
      end if;
    end if;

    -- Unit-conversion gap: surface as `unit_conversion_unavailable`.
    if v_required_base is null or v_available_base is null then
      v_has_missing_any := true;
      if v_ri.is_key then
        v_has_missing_key := true;
      end if;
      v_missing := v_missing || jsonb_build_object(
        'ingredient_id', v_ri.ingredient_id,
        'user_ingredient_id', v_ri.user_ingredient_id,
        'name', v_ingredient_name,
        'is_key', v_ri.is_key,
        'is_pending', (v_ri.user_ingredient_id is not null),
        'base_unit', v_base_unit,
        'missing_quantity', null,
        'reason', 'unit_conversion_unavailable'
      );
      continue;
    end if;

    -- Quantity comparison in base units.
    if v_available_base >= v_required_base then
      continue;
    else
      v_missing_quantity := v_required_base - v_available_base;
      v_has_missing_any := true;
      if v_ri.is_key then
        v_has_missing_key := true;
      end if;
      v_missing := v_missing || jsonb_build_object(
        'ingredient_id', v_ri.ingredient_id,
        'user_ingredient_id', v_ri.user_ingredient_id,
        'name', v_ingredient_name,
        'is_key', v_ri.is_key,
        'is_pending', (v_ri.user_ingredient_id is not null),
        'base_unit', v_base_unit,
        'missing_quantity', v_missing_quantity,
        'reason', 'insufficient_quantity'
      );
    end if;
  end loop;

  -- Final status: green if nothing missing, orange if any key missing,
  -- otherwise yellow.
  if not v_has_missing_any then
    status := 'green';
  elsif v_has_missing_key then
    status := 'orange';
  else
    status := 'yellow';
  end if;

  missing_ingredients := v_missing;
  return next;
end$function$;


-- ---- compute_library_status -----------------------------------------
-- Library-wide semáforo: returns one row per non-draft recipe in the
-- user's library with its computed status + missing ingredients.
create or replace function public.compute_library_status(p_user_id uuid)
returns table (
  recipe_id            uuid,
  recipe_title         text,
  status               text,
  missing_ingredients  jsonb
)
language plpgsql
stable
set search_path = public
as $function$
begin
  return query
  select r.id, r.title, crs.status, crs.missing_ingredients
  from public.library l
  join public.recipes r on r.id = l.recipe_id
  cross join lateral public.compute_recipe_status(l.recipe_id, p_user_id) crs
  where l.user_id = p_user_id and r.is_draft = false;
end$function$;


-- =====================================================================
-- 4) TRIGGER FUNCTIONS + TRIGGERS
-- =====================================================================

-- ---- check_pantry_user_ingredient_ownership -------------------------
-- Guards pantry_items so a quarantine reference can only belong to a
-- pantry row whose owner is the same as the quarantine ingredient's
-- creator. Prevents one user from referencing another user's quarantine.
create or replace function public.check_pantry_user_ingredient_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.user_ingredient_id is not null then
    if not exists (
      select 1 from public.user_ingredients ui
      where ui.id = new.user_ingredient_id
        and ui.created_by = new.user_id
    ) then
      raise exception 'pantry_items.user_ingredient_id must reference a user_ingredient owned by the same user';
    end if;
  end if;
  return new;
end$function$;


-- ---- check_user_ingredient_uniqueness -------------------------------
-- Prevents a user from creating a quarantine row whose normalized name
-- already exists in the global catalog or in the user's own pending
-- pile. Implements the duplicate guard added by migration 007.
create or replace function public.check_user_ingredient_uniqueness()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_normalized text;
begin
  v_normalized := lower(trim(new.name));

  if exists (
    select 1 from public.ingredients
    where lower(trim(name)) = v_normalized
  ) then
    raise exception 'Ingredient "%" already exists in the global catalog. Select it from search results instead.', new.name
      using errcode = 'unique_violation';
  end if;

  if exists (
    select 1 from public.user_ingredients
    where created_by = new.created_by
      and lower(trim(name)) = v_normalized
      and id <> new.id
  ) then
    raise exception 'You already have a pending ingredient called "%". Select it from search results instead.', new.name
      using errcode = 'unique_violation';
  end if;

  return new;
end$function$;


-- ---- Triggers (idempotent via drop-if-exists) -----------------------
drop trigger if exists trg_pantry_user_ingredient_ownership on public.pantry_items;
create trigger trg_pantry_user_ingredient_ownership
before insert or update on public.pantry_items
for each row execute function public.check_pantry_user_ingredient_ownership();

drop trigger if exists trg_user_ingredient_uniqueness on public.user_ingredients;
create trigger trg_user_ingredient_uniqueness
before insert or update of name on public.user_ingredients
for each row execute function public.check_user_ingredient_uniqueness();


-- =====================================================================
-- 5) FUNCTION GRANTS (idempotent)
-- =====================================================================
-- Engine + helper functions are callable by `authenticated`. Trigger
-- functions are invoked by the system; no explicit grants needed.
grant execute on function public.kb_base_unit_id(text)                              to authenticated;
grant execute on function public.kb_convert_to_base(uuid, numeric, uuid)            to authenticated;
grant execute on function public.kb_find_pantry_match(uuid, uuid, uuid)             to authenticated;
grant execute on function public.compute_recipe_status(uuid, uuid)                  to authenticated;
grant execute on function public.compute_library_status(uuid)                       to authenticated;


-- =====================================================================
-- 6) ROW LEVEL SECURITY — enable + policies
-- =====================================================================
-- Every public table has RLS enabled. Policies follow two patterns:
--   * Catalog tables (read-only for end users): SELECT-only with qual=true
--     for `authenticated`. Writes are admin-only via service-role.
--   * User-owned tables: ALL or CRUD-split policies scoped by
--     `user_id = auth.uid()` (or `created_by` / via a parent recipe).

alter table public.cooking_history       enable row level security;
alter table public.ingredient_categories enable row level security;
alter table public.ingredients           enable row level security;
alter table public.library               enable row level security;
alter table public.pantry_items          enable row level security;
alter table public.recipe_ingredients    enable row level security;
alter table public.recipe_steps          enable row level security;
alter table public.recipes               enable row level security;
alter table public.shopping_list_items   enable row level security;
alter table public.translations          enable row level security;
alter table public.unit_conversions      enable row level security;
alter table public.units                 enable row level security;
alter table public.user_ingredients      enable row level security;


-- ---- cooking_history ------------------------------------------------
drop policy if exists cooking_history_all_owner on public.cooking_history;
create policy cooking_history_all_owner
  on public.cooking_history
  as permissive
  for all
  to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ---- ingredient_categories (catalog, read-only) ---------------------
drop policy if exists catalog_categories_select on public.ingredient_categories;
create policy catalog_categories_select
  on public.ingredient_categories
  as permissive
  for select
  to authenticated
  using (true);


-- ---- ingredients (catalog, read-only) -------------------------------
drop policy if exists catalog_ingredients_select on public.ingredients;
create policy catalog_ingredients_select
  on public.ingredients
  as permissive
  for select
  to authenticated
  using (true);


-- ---- library --------------------------------------------------------
drop policy if exists library_all_owner on public.library;
create policy library_all_owner
  on public.library
  as permissive
  for all
  to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ---- pantry_items ---------------------------------------------------
drop policy if exists pantry_items_all_owner on public.pantry_items;
create policy pantry_items_all_owner
  on public.pantry_items
  as permissive
  for all
  to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ---- recipe_ingredients (scoped via parent recipe ownership) --------
drop policy if exists recipe_ingredients_select on public.recipe_ingredients;
create policy recipe_ingredients_select
  on public.recipe_ingredients
  as permissive
  for select
  to authenticated
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_ingredients.recipe_id
        and (r.user_id = auth.uid() or r.status = 'public')
    )
  );

drop policy if exists recipe_ingredients_insert on public.recipe_ingredients;
create policy recipe_ingredients_insert
  on public.recipe_ingredients
  as permissive
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_ingredients.recipe_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists recipe_ingredients_update on public.recipe_ingredients;
create policy recipe_ingredients_update
  on public.recipe_ingredients
  as permissive
  for update
  to authenticated
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_ingredients.recipe_id
        and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_ingredients.recipe_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists recipe_ingredients_delete on public.recipe_ingredients;
create policy recipe_ingredients_delete
  on public.recipe_ingredients
  as permissive
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_ingredients.recipe_id
        and r.user_id = auth.uid()
    )
  );


-- ---- recipe_steps (scoped via parent recipe ownership) --------------
drop policy if exists recipe_steps_select on public.recipe_steps;
create policy recipe_steps_select
  on public.recipe_steps
  as permissive
  for select
  to authenticated
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_steps.recipe_id
        and (r.user_id = auth.uid() or r.status = 'public')
    )
  );

drop policy if exists recipe_steps_insert on public.recipe_steps;
create policy recipe_steps_insert
  on public.recipe_steps
  as permissive
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_steps.recipe_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists recipe_steps_update on public.recipe_steps;
create policy recipe_steps_update
  on public.recipe_steps
  as permissive
  for update
  to authenticated
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_steps.recipe_id
        and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_steps.recipe_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists recipe_steps_delete on public.recipe_steps;
create policy recipe_steps_delete
  on public.recipe_steps
  as permissive
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_steps.recipe_id
        and r.user_id = auth.uid()
    )
  );


-- ---- recipes --------------------------------------------------------
drop policy if exists recipes_select_owner_or_public on public.recipes;
create policy recipes_select_owner_or_public
  on public.recipes
  as permissive
  for select
  to authenticated
  using (user_id = auth.uid() or status = 'public');

drop policy if exists recipes_insert_owner on public.recipes;
create policy recipes_insert_owner
  on public.recipes
  as permissive
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists recipes_update_owner on public.recipes;
create policy recipes_update_owner
  on public.recipes
  as permissive
  for update
  to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists recipes_delete_owner on public.recipes;
create policy recipes_delete_owner
  on public.recipes
  as permissive
  for delete
  to authenticated
  using (user_id = auth.uid());


-- ---- shopping_list_items --------------------------------------------
drop policy if exists shopping_list_items_all_owner on public.shopping_list_items;
create policy shopping_list_items_all_owner
  on public.shopping_list_items
  as permissive
  for all
  to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ---- translations (catalog, read-only) ------------------------------
drop policy if exists catalog_translations_select on public.translations;
create policy catalog_translations_select
  on public.translations
  as permissive
  for select
  to authenticated
  using (true);


-- ---- unit_conversions (catalog, read-only) --------------------------
drop policy if exists catalog_unit_conv_select on public.unit_conversions;
create policy catalog_unit_conv_select
  on public.unit_conversions
  as permissive
  for select
  to authenticated
  using (true);


-- ---- units (catalog, read-only) -------------------------------------
drop policy if exists catalog_units_select on public.units;
create policy catalog_units_select
  on public.units
  as permissive
  for select
  to authenticated
  using (true);


-- ---- user_ingredients (insert-own + select-own only) ----------------
-- No UPDATE or DELETE policies exist on this table by design: quarantine
-- is admin-managed via service-role once submitted.
drop policy if exists user_ingredients_insert_own on public.user_ingredients;
create policy user_ingredients_insert_own
  on public.user_ingredients
  as permissive
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists user_ingredients_select_own on public.user_ingredients;
create policy user_ingredients_select_own
  on public.user_ingredients
  as permissive
  for select
  to authenticated
  using (created_by = auth.uid());

-- ====== END OF SNAPSHOT ==============================================
