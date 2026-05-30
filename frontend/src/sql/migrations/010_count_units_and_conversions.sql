-- KitchenBase — Migration 010
-- Count units catalog + seed conversions for piece-counted ingredients.
-- Decision D-034 (Registro de Decisiones v1.7), Modelo de Datos v1.6.
--
-- Background
-- ----------
-- KitchenBase models every ingredient against a base unit of grams or
-- milliliters (`ingredients.base_unit` is 'g' or 'ml'). D-034 establishes
-- that piece-counted units ('unidad', 'diente') and imprecise units
-- ('pizca') are NOT a separate axis: they are ordinary `units` rows that
-- reach the base via a per-ingredient row in `unit_conversions`.
--
-- The conversion is per-ingredient because the weight of a piece varies
-- (1 garlic clove approx 5 g; 1 egg approx 50 g; 1 onion approx 150 g) —
-- there is no universal "piece -> grams" factor.
--
-- This migration only:
--   1) Adds the unit `diente` (garlic clove) to the `units` catalog.
--   2) Seeds a small number of `unit_conversions` rows so the
--      count-unit ingredients that already exist can be compared by
--      the engine.
--
-- The semáforo engine was frozen by E1.1 (migration 009). This migration
-- does NOT touch the engine, its functions, RLS, triggers, or any
-- frontend file. All inserts are guarded by NOT EXISTS so the script is
-- safe to re-run.
--
-- Live discovery notes (recorded for traceability):
--   * Ajo     (g): zero existing conversions -> diente row will be inserted (5 g).
--   * Huevo   (g): an existing (unidad -> 60 g) row already lives in
--                  unit_conversions; the NOT EXISTS guard preserves it.
--   * Cebolla (g): an existing (unidad -> 150 g) row already matches the
--                  seed factor; the NOT EXISTS guard preserves it.
-- Section 4 (default_unit_id refinement) was deliberately SKIPPED per
-- the D-034 prompt; defaults remain on the base unit (gramo), which
-- trivially satisfies the D-034 invariant.

-- =====================================================================
-- Section 2 — Add the `diente` unit (idempotent on name)
-- =====================================================================
-- dimension stays NULL: a clove is neither mass nor volume (D-034).
-- is_base is false; unit_system='culinary' to match the pattern of the
-- other culinary count/imprecise units (pizca, unidad, taza).
INSERT INTO public.units (name, symbol, unit_system, is_base, dimension)
SELECT 'diente', 'diente', 'culinary', false, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.units WHERE name = 'diente'
);


-- =====================================================================
-- Section 3 — Seed per-ingredient count conversions (defensive)
-- =====================================================================
-- Each insert resolves the ingredient id and unit id by lookup (no
-- hardcoded UUIDs), is a no-op when the ingredient is missing, and is a
-- no-op when the (ingredient_id, unit_id) pair already exists.

-- 3.1 Ajo: 1 diente ~= 5 g
INSERT INTO public.unit_conversions (ingredient_id, unit_id, to_base_factor, notes)
SELECT i.id, u.id, 5, 'Seed example (D-034): 1 clove approx 5 g'
FROM public.ingredients i, public.units u
WHERE lower(i.name) = lower('Ajo')
  AND u.name = 'diente'
  AND i.base_unit = 'g'
  AND NOT EXISTS (
    SELECT 1 FROM public.unit_conversions c
    WHERE c.ingredient_id = i.id AND c.unit_id = u.id
  );

-- 3.2 Huevo: 1 unidad ~= 50 g
-- NOTE (honest deviation report): an existing row already maps
-- (Huevo, unidad) -> 60 g. The NOT EXISTS guard preserves that value;
-- no UPDATE is performed in this migration.
INSERT INTO public.unit_conversions (ingredient_id, unit_id, to_base_factor, notes)
SELECT i.id, u.id, 50, 'Seed example (D-034): 1 egg approx 50 g'
FROM public.ingredients i, public.units u
WHERE lower(i.name) = lower('Huevo')
  AND u.name = 'unidad'
  AND i.base_unit = 'g'
  AND NOT EXISTS (
    SELECT 1 FROM public.unit_conversions c
    WHERE c.ingredient_id = i.id AND c.unit_id = u.id
  );

-- 3.3 Cebolla: 1 unidad ~= 150 g
-- The (Cebolla, unidad) -> 150 g row already exists; this insert
-- intentionally becomes a no-op via the NOT EXISTS guard.
INSERT INTO public.unit_conversions (ingredient_id, unit_id, to_base_factor, notes)
SELECT i.id, u.id, 150, 'Seed example (D-034): 1 onion approx 150 g'
FROM public.ingredients i, public.units u
WHERE lower(i.name) = lower('Cebolla')
  AND u.name = 'unidad'
  AND i.base_unit = 'g'
  AND NOT EXISTS (
    SELECT 1 FROM public.unit_conversions c
    WHERE c.ingredient_id = i.id AND c.unit_id = u.id
  );


-- =====================================================================
-- Section 4 — SKIPPED (intentional)
-- =====================================================================
-- Refining `ingredients.default_unit_id` for Ajo/Huevo/Cebolla to the
-- culinary count unit (diente/unidad) is optional UX polish, not engine
-- correctness. All three currently point to `gramo` (the base unit), so
-- the D-034 invariant ("default must be base OR have a conversion") is
-- already satisfied. The change would touch admin/recipe-wizard UI
-- preselection behavior and is deferred to a dedicated follow-up.
