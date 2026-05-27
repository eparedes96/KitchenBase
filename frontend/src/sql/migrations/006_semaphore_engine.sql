-- 006_semaphore_engine.sql
-- Builds the traffic-light computation engine as PostgreSQL functions.
-- Implements the algorithm documented in section 7 of the Data Model v1.2,
-- including the handling of quarantine ingredients (D-029).

-- =====================================================================
-- HELPER FUNCTION 1: Convert a quantity expressed in any unit
-- to the base unit of a catalog ingredient, using unit_conversions.
-- Returns NULL if no conversion path exists.
-- =====================================================================
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
  v_base_unit text;
  v_factor numeric;
  v_unit_name text;
begin
  -- Get the ingredient's base unit
  select base_unit into v_base_unit
  from public.ingredients
  where id = p_ingredient_id;

  if v_base_unit is null then
    return null;
  end if;

  -- Get the unit's symbol (to check if it's already the base unit)
  select symbol into v_unit_name
  from public.units
  where id = p_unit_id;

  -- If the unit is already the base unit (g or ml), no conversion needed
  if v_unit_name = v_base_unit then
    return p_quantity;
  end if;

  -- Look up the conversion factor for this ingredient + unit
  select to_base_factor into v_factor
  from public.unit_conversions
  where ingredient_id = p_ingredient_id and unit_id = p_unit_id;

  if v_factor is null then
    return null;
  end if;

  return p_quantity * v_factor;
end$$;

-- =====================================================================
-- HELPER FUNCTION 2: Find the matching pantry_items row for a given
-- recipe ingredient (catalog or quarantine), for a given user.
-- Returns the pantry_items row or NULL if no match.
-- =====================================================================
create or replace function public.kb_find_pantry_match(
  p_user_id uuid,
  p_ingredient_id uuid,
  p_user_ingredient_id uuid
)
returns table (
  pantry_id uuid,
  pantry_quantity numeric,
  pantry_unit_id uuid,
  is_basic boolean
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if p_ingredient_id is not null then
    -- Catalog ingredient: match on ingredient_id
    return query
      select pi.id, pi.quantity, pi.unit_id, pi.is_basic
      from public.pantry_items pi
      where pi.user_id = p_user_id
        and pi.ingredient_id = p_ingredient_id
      limit 1;
  elsif p_user_ingredient_id is not null then
    -- Quarantine ingredient: match on user_ingredient_id
    return query
      select pi.id, pi.quantity, pi.unit_id, pi.is_basic
      from public.pantry_items pi
      where pi.user_id = p_user_id
        and pi.user_ingredient_id = p_user_ingredient_id
      limit 1;
  end if;
end$$;

-- =====================================================================
-- MAIN FUNCTION 1: compute_recipe_status
-- Computes the traffic-light status for a single recipe for a given user.
-- Returns the status and the list of missing ingredients (as JSON).
-- =====================================================================
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
begin
  -- Iterate over each ingredient of the recipe
  for v_ri in
    select
      ri.id as ri_id,
      ri.ingredient_id,
      ri.user_ingredient_id,
      ri.quantity as ri_quantity,
      ri.unit_id as ri_unit_id,
      ri.is_key
    from public.recipe_ingredients ri
    where ri.recipe_id = p_recipe_id
  loop
    -- Resolve the ingredient name and base unit, for the response payload
    if v_ri.ingredient_id is not null then
      select i.name, i.base_unit into v_ingredient_name, v_base_unit
      from public.ingredients i
      where i.id = v_ri.ingredient_id;
    else
      select ui.name, ui.base_unit into v_ingredient_name, v_base_unit
      from public.user_ingredients ui
      where ui.id = v_ri.user_ingredient_id;
    end if;

    -- Find a matching pantry row
    select * into v_pantry
    from public.kb_find_pantry_match(p_user_id, v_ri.ingredient_id, v_ri.user_ingredient_id);

    -- CASE 1: ingredient is in the pantry AND marked as basic → always available
    if v_pantry.pantry_id is not null and v_pantry.is_basic = true then
      continue;
    end if;

    -- CASE 2: ingredient is NOT in the pantry → missing entirely
    if v_pantry.pantry_id is null then
      v_has_missing_any := true;
      if v_ri.is_key then v_has_missing_key := true; end if;
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

    -- CASE 3: ingredient is in the pantry but not basic → compare quantities
    -- Convert both required and available to the base unit.
    if v_ri.ingredient_id is not null then
      -- Catalog ingredient: use unit_conversions
      v_required_base := public.kb_convert_to_base(v_ri.ingredient_id, v_ri.ri_quantity, v_ri.ri_unit_id);
      v_available_base := public.kb_convert_to_base(v_ri.ingredient_id, v_pantry.pantry_quantity, v_pantry.pantry_unit_id);
    else
      -- Quarantine ingredient: only direct match (same unit_id as the base unit)
      -- Look up the base unit's row in `units` to see if the recipe's unit_id matches
      if exists (
        select 1 from public.units u
        where u.id = v_ri.ri_unit_id and u.symbol = v_base_unit
      ) then
        v_required_base := v_ri.ri_quantity;
      else
        v_required_base := null;
      end if;
      if exists (
        select 1 from public.units u
        where u.id = v_pantry.pantry_unit_id and u.symbol = v_base_unit
      ) then
        v_available_base := v_pantry.pantry_quantity;
      else
        v_available_base := null;
      end if;
    end if;

    -- If either conversion failed, we cannot determine availability.
    -- Treat as missing with reason 'unit_conversion_unavailable'.
    if v_required_base is null or v_available_base is null then
      v_has_missing_any := true;
      if v_ri.is_key then v_has_missing_key := true; end if;
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

    -- Compare quantities
    if v_available_base >= v_required_base then
      -- Available — no action
      continue;
    else
      v_missing_quantity := v_required_base - v_available_base;
      v_has_missing_any := true;
      if v_ri.is_key then v_has_missing_key := true; end if;
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

  -- Determine final status
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
-- MAIN FUNCTION 2: compute_library_status
-- Computes the traffic-light status for ALL recipes in the user's library
-- in a single call. Used by Library and Home screens.
-- =====================================================================
create or replace function public.compute_library_status(p_user_id uuid)
returns table (
  recipe_id uuid,
  recipe_title text,
  status text,
  missing_ingredients jsonb
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  return query
  select
    r.id,
    r.title,
    crs.status,
    crs.missing_ingredients
  from public.library l
  join public.recipes r on r.id = l.recipe_id
  cross join lateral public.compute_recipe_status(l.recipe_id, p_user_id) crs
  where l.user_id = p_user_id
    and r.is_draft = false;
end$$;

-- =====================================================================
-- PERMISSIONS
-- These functions are SECURITY INVOKER, so they execute with the
-- privileges of the calling user. Grant EXECUTE to authenticated.
-- =====================================================================
grant execute on function public.kb_convert_to_base(uuid, numeric, uuid) to authenticated;
grant execute on function public.kb_find_pantry_match(uuid, uuid, uuid) to authenticated;
grant execute on function public.compute_recipe_status(uuid, uuid) to authenticated;
grant execute on function public.compute_library_status(uuid) to authenticated;
