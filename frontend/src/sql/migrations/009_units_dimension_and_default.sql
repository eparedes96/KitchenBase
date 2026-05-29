-- KitchenBase — Migration 009
-- Close the semaphore-engine fragility for good: resolve the canonical base
-- unit by (is_base, dimension), never by free-text `units.symbol` again.
-- Decision D-033 (Registro de Decisiones v1.6), Modelo de Datos v1.5.
--
-- Background
-- ----------
-- Migration 008 (D-032) made the engine compare incoming units by `unit_id`
-- instead of by `symbol` text, but the helper `kb_base_unit_id(base_unit)`
-- still distinguished gramo from mililitro by `symbol = p_base_unit` because
-- both base rows share `is_base = TRUE`. So a robustness test that mutated
-- `gramo.symbol = 'gr'` still flipped recipes off green — the engine was
-- only PARTIALLY robust.
--
-- D-033 closes this by introducing `units.dimension` ('mass' | 'volume',
-- nullable) and rebuilding `kb_base_unit_id` around it. The helper now
-- resolves the base row purely by the dimensional axis, with no reference
-- to free-text `symbol` anywhere in the engine.
--
-- This migration is additive and idempotent. It does NOT alter any other
-- table, RLS policy, trigger, or frontend file.

-- =====================================================================
-- Step 1 — Schema additions: two new nullable columns.
-- =====================================================================
-- units.dimension: the physical magnitude the unit measures.
-- NULL for count/culinary units ('ud', 'pizca') that are neither mass nor
-- volume. The CHECK constraint allows the two valid values; NULL is
-- accepted by PostgreSQL CHECK semantics.
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS dimension TEXT;

ALTER TABLE public.units
  DROP CONSTRAINT IF EXISTS units_dimension_check;
ALTER TABLE public.units
  ADD CONSTRAINT units_dimension_check
  CHECK (dimension IN ('mass', 'volume'));

-- ingredients.default_unit_id: the unit the admin UI will preselect when
-- stocking this ingredient. Populated by the admin panel in Wave 2; this
-- migration only seeds a few defensive examples.
ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS default_unit_id UUID;

ALTER TABLE public.ingredients
  DROP CONSTRAINT IF EXISTS ingredients_default_unit_id_fkey;
ALTER TABLE public.ingredients
  ADD CONSTRAINT ingredients_default_unit_id_fkey
  FOREIGN KEY (default_unit_id) REFERENCES public.units(id)
  ON DELETE SET NULL;


-- =====================================================================
-- Step 2 — Populate `dimension` for the 8 mass/volume units.
-- 'ud' (unidad) and 'pizca' are intentionally left NULL: they are not
-- cleanly mass or volume and must stay NULL per D-033.
-- =====================================================================
UPDATE public.units
   SET dimension = 'mass'
 WHERE symbol IN ('g', 'kg');

UPDATE public.units
   SET dimension = 'volume'
 WHERE symbol IN ('ml', 'l', 'cda', 'cdta', 'taza');


-- =====================================================================
-- Step 3 — Defensive example defaults for existing ingredients only.
-- Guarded so it is a no-op when no matching row exists. Real production
-- defaults will be set by the admin panel in Wave 2.
-- =====================================================================
UPDATE public.ingredients i
   SET default_unit_id = u.id
  FROM public.units u
 WHERE i.default_unit_id IS NULL
   AND i.base_unit = 'g'
   AND u.is_base = TRUE
   AND u.dimension = 'mass';

UPDATE public.ingredients i
   SET default_unit_id = u.id
  FROM public.units u
 WHERE i.default_unit_id IS NULL
   AND i.base_unit = 'ml'
   AND u.is_base = TRUE
   AND u.dimension = 'volume';


-- =====================================================================
-- Step 4 — Rewrite `kb_base_unit_id` so it never touches `symbol` again.
-- It maps the ingredient's `base_unit` text ('g'/'ml') to a dimension
-- ('mass'/'volume') and returns the single is_base=TRUE row of that
-- dimension. This is the ONLY place in the engine that interprets
-- `base_unit`, and it does so on the dimensional axis, not on free text.
--
-- `kb_convert_to_base` and `compute_recipe_status` (migration 008) keep
-- calling `kb_base_unit_id` exactly as before. No other engine code is
-- changed by this migration.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.kb_base_unit_id(p_base_unit TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT u.id
  FROM public.units u
  WHERE u.is_base = TRUE
    AND u.dimension = CASE
      WHEN p_base_unit = 'g'  THEN 'mass'
      WHEN p_base_unit = 'ml' THEN 'volume'
      ELSE NULL
    END
  LIMIT 1;
$$;


-- =====================================================================
-- Step 5 — Grants (idempotent; matches the 008 pattern).
-- =====================================================================
GRANT EXECUTE ON FUNCTION public.kb_base_unit_id(text) TO authenticated;
