-- KitchenBase — Migration 008
-- Semáforo engine hardening: resolve the canonical base unit by units.is_base
-- (decision D-032, Data Model v1.4 §7.4).
--
-- This migration is FUNCTIONS-ONLY. It does NOT alter any table, column,
-- index, constraint, RLS policy, or seed data. Every statement is
-- idempotent (`create or replace function`), so re-running this script
-- is safe.
--
-- Bug being fixed
-- ---------------
-- The previous engine (migration 006) decided "is the incoming unit
-- already the ingredient's base unit?" by comparing the free-text
-- `units.symbol` against `ingredients.base_unit`. This only worked
-- because today the seeded base units happen to have `symbol = 'g'` and
-- `symbol = 'ml'`, matching `base_unit` character-for-character. Any
-- variant ('gr', 'G', 'gramo') would have broken the equality, fallen
-- through to `unit_conversions`, found no factor, returned NULL, and
-- the semáforo would have wrongly reported the ingredient as
-- `unit_conversion_unavailable` — keeping recipes off green.
--
-- Fix
-- ---
-- Introduce a tiny helper `kb_base_unit_id(text)` that maps a base unit
-- string ('g' / 'ml') to the canonical catalog row using `is_base = true`.
-- This is now the only place in the engine that touches `units.symbol`,
-- and it only does so against the two admin-controlled base rows whose
-- symbols are fixed by the data model. Everywhere else the engine
-- compares by `unit_id`, which is robust to any future free-text
-- variation in `symbol`.
--
-- This migration also makes the pantry-not-found case explicit inside
-- `compute_recipe_status`, so the function never reads fields of a row
-- that wasn't returned by `kb_find_pantry_match`.

-- =====================================================================
-- 1) Helper: kb_base_unit_id(base_unit text) -> uuid
-- =====================================================================
-- Returns the catalog row id of the canonical base unit for a given
-- ingredient base unit string ('g' or 'ml'). Looks up by
-- `is_base = true` (an admin-managed boolean on `units`), with `symbol`
-- as a tiebreaker — by data-model convention there is exactly one
-- is_base=true row per base unit string.
create or replace function public.kb_base_unit_id(p_base_unit text)
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select u.id
  from public.units u
  where u.is_base = true and u.symbol = p_base_unit
  limit 1;
$$;


-- =====================================================================
-- 2) kb_convert_to_base — unit_id comparison (no more symbol matching)
-- =====================================================================
-- Returns the quantity expressed in the ingredient's base unit (g/ml),
-- or NULL if no conversion path is known.
--
-- Behavior change vs migration 006:
--   * Decides "this unit IS already the base unit" by comparing
--     `p_unit_id = kb_base_unit_id(base_unit)` instead of comparing the
--     free-text `units.symbol` against `ingredients.base_unit`.
--   * No other change. The unit_conversions fallback is preserved
--     identically.
create or replace function public.kb_convert_to_base(
  p_ingredient_id uuid,
  p_quantity numeric,
  p_unit_id uuid
)
returns numeric
language plpgsql
stable
security invoker
set search_path = public
as $$
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
end$$;


-- =====================================================================
-- 3) compute_recipe_status — explicit no-pantry guard + canonical
--    quarantine base-unit comparison
-- =====================================================================
-- Re-created in full because the changes are inside its main loop.
-- Behavior changes vs migration 006:
--   (a) After calling `kb_find_pantry_match`, an explicit guard handles
--       the not-found case (no pantry row -> ingredient is missing with
--       reason='not_in_pantry'), so the function never reads fields of
--       a row that wasn't returned.
--   (b) Quarantine ingredients (user_ingredient_id set) used to decide
--       "this unit is the base unit" by `u.symbol = v_base_unit`. They
--       now use the canonical kb_base_unit_id and compare by unit_id,
--       matching kb_convert_to_base. (D-032)
-- Everything else (jsonb shape, status/key flags, basics behavior) is
-- preserved identically.
create or replace function public.compute_recipe_status(
  p_recipe_id uuid,
  p_user_id uuid
)
returns table (
  status text,
  missing_ingredients jsonb
)
language plpgsql
stable
security invoker
set search_path = public
as $$
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
end$$;


-- =====================================================================
-- 4) Grants (idempotent)
-- =====================================================================
grant execute on function public.kb_base_unit_id(text) to authenticated;
grant execute on function public.kb_convert_to_base(uuid, numeric, uuid) to authenticated;
grant execute on function public.compute_recipe_status(uuid, uuid) to authenticated;
