-- =====================================================================
-- KitchenBase — Despensa flow seed data
-- =====================================================================
-- Paste this entire file into the Supabase SQL Editor and click "Run".
-- It is fully idempotent (uses ON CONFLICT DO NOTHING) and safe to re-run.
--
-- This migration also:
--   - enables the unaccent extension (used for accent-insensitive search)
--   - registers public.pantry_items in the supabase_realtime publication
--     (so PAN-001 can subscribe to live changes)
--   - adds a helper function `kb_norm(text)` that lowercases + strips
--     accents, used by the catalog search endpoint
-- =====================================================================

-- 1) Extensions ---------------------------------------------------------
create extension if not exists unaccent;

-- 2) Normalization helper (immutable so it can be indexed) --------------
create or replace function public.kb_norm(value text)
  returns text
  language sql
  immutable
  parallel safe
as $$
  select lower(unaccent(coalesce(value, '')));
$$;

-- Speed up catalog ILIKE searches
create index if not exists idx_ingredients_name_norm
  on public.ingredients (public.kb_norm(name));

-- 3) Realtime publication for live updates of pantry_items --------------
do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'pantry_items'
  ) then
    alter publication supabase_realtime add table public.pantry_items;
  end if;
end$$;

-- =====================================================================
-- INGREDIENT CATEGORIES
-- =====================================================================
insert into public.ingredient_categories (name, icon, sort_order) values
  ('Lácteos',                  'milk',     10),
  ('Carnes',                   'beef',     20),
  ('Pescados',                 'fish',     30),
  ('Verduras',                 'carrot',   40),
  ('Frutas',                   'apple',    50),
  ('Cereales y pasta',         'wheat',    60),
  ('Legumbres',                'bean',     70),
  ('Huevos',                   'egg',      80),
  ('Aceites y grasas',         'droplet',  90),
  ('Condimentos y especias',   'salt',    100)
on conflict (name) do nothing;

-- =====================================================================
-- UNITS
-- =====================================================================
insert into public.units (name, symbol, unit_system, is_base) values
  ('gramo',        'g',     'metric',   true),
  ('kilogramo',    'kg',    'metric',   false),
  ('mililitro',    'ml',    'metric',   true),
  ('litro',        'l',     'metric',   false),
  ('unidad',       'ud',    'culinary', false),
  ('cucharada',    'cda',   'culinary', false),
  ('cucharadita',  'cdta',  'culinary', false),
  ('taza',         'taza',  'culinary', false),
  ('pizca',        'pizca', 'culinary', false)
on conflict (name) do nothing;

-- =====================================================================
-- INGREDIENTS
-- =====================================================================
-- Helper insert pattern: resolve category_id by JOIN on name.
insert into public.ingredients
  (name, category_id, base_unit, is_key_default,
   kcal_per_100, protein_per_100, carbs_per_100, fat_per_100, fiber_per_100)
select v.name, c.id, v.base_unit, v.is_key_default,
       v.kcal, v.protein, v.carbs, v.fat, v.fiber
from (values
  ('Huevo',                   'Huevos',                 'g',  true,  155,  13.0,  1.1, 11.0, 0.0),
  ('Leche entera',            'Lácteos',                'ml', true,   64,   3.2,  4.8,  3.6, 0.0),
  ('Yogur natural',           'Lácteos',                'g',  false,  59,   3.5,  4.7,  3.3, 0.0),
  ('Queso fresco',            'Lácteos',                'g',  false, 174,  12.0,  4.0, 12.0, 0.0),
  ('Pechuga de pollo',        'Carnes',                 'g',  true,  165,  31.0,  0.0,  3.6, 0.0),
  ('Carne picada de ternera', 'Carnes',                 'g',  true,  250,  26.0,  0.0, 17.0, 0.0),
  ('Salmón fresco',           'Pescados',               'g',  true,  208,  20.0,  0.0, 13.0, 0.0),
  ('Atún en lata',            'Pescados',               'g',  false, 116,  26.0,  0.0,  1.0, 0.0),
  ('Tomate',                  'Verduras',               'g',  true,   18,   0.9,  3.9,  0.2, 1.2),
  ('Cebolla',                 'Verduras',               'g',  false,  40,   1.1,  9.3,  0.1, 1.7),
  ('Pimiento rojo',           'Verduras',               'g',  true,   31,   1.0,  6.0,  0.3, 2.1),
  ('Lechuga',                 'Verduras',               'g',  false,  15,   1.4,  2.9,  0.2, 1.3),
  ('Patata',                  'Verduras',               'g',  true,   77,   2.0, 17.0,  0.1, 2.2),
  ('Manzana',                 'Frutas',                 'g',  false,  52,   0.3, 14.0,  0.2, 2.4),
  ('Plátano',                 'Frutas',                 'g',  false,  89,   1.1, 23.0,  0.3, 2.6),
  ('Pasta seca',              'Cereales y pasta',       'g',  true,  371,  13.0, 75.0,  1.5, 3.2),
  ('Arroz blanco',            'Cereales y pasta',       'g',  true,  365,   7.1, 80.0,  0.7, 1.3),
  ('Pan',                     'Cereales y pasta',       'g',  true,  265,   9.0, 49.0,  3.2, 2.7),
  ('Lentejas',                'Legumbres',              'g',  true,  116,   9.0, 20.0,  0.4, 7.9),
  ('Aceite de oliva',         'Aceites y grasas',       'ml', false, 884,   0.0,  0.0, 100.0, 0.0),
  ('Sal',                     'Condimentos y especias', 'g',  false,   0,   0.0,  0.0,  0.0, 0.0),
  ('Pimienta negra',          'Condimentos y especias', 'g',  false, 251,  10.0, 64.0,  3.3, 25.0),
  ('Ajo',                     'Condimentos y especias', 'g',  false, 149,   6.4, 33.0,  0.5, 2.1)
) as v(name, cat_name, base_unit, is_key_default, kcal, protein, carbs, fat, fiber)
join public.ingredient_categories c on c.name = v.cat_name
on conflict (name) do nothing;

-- =====================================================================
-- UNIT CONVERSIONS
-- =====================================================================
-- For ingredients in grams that have a meaningful "unidad" (piece) weight.
insert into public.unit_conversions (ingredient_id, unit_id, to_base_factor)
select i.id, u.id, v.factor
from (values
  ('Huevo',          'unidad',   60.0),
  ('Manzana',        'unidad',  180.0),
  ('Plátano',        'unidad',  120.0),
  ('Tomate',         'unidad',  120.0),
  ('Cebolla',        'unidad',  150.0),
  ('Pimiento rojo',  'unidad',  150.0),
  ('Patata',         'unidad',  200.0)
) as v(ing_name, unit_name, factor)
join public.ingredients i on i.name = v.ing_name
join public.units u       on u.name = v.unit_name
where not exists (
  select 1 from public.unit_conversions x
   where x.ingredient_id = i.id and x.unit_id = u.id
);

-- For liquid-based ingredients (ml): cucharada (15ml) and taza (250ml).
insert into public.unit_conversions (ingredient_id, unit_id, to_base_factor)
select i.id, u.id, v.factor
from (values
  ('Leche entera',     'cucharada', 15.0),
  ('Leche entera',     'taza',     250.0),
  ('Aceite de oliva',  'cucharada', 15.0),
  ('Aceite de oliva',  'taza',     250.0),
  ('Aceite de oliva',  'cucharadita', 5.0)
) as v(ing_name, unit_name, factor)
join public.ingredients i on i.name = v.ing_name
join public.units u       on u.name = v.unit_name
where not exists (
  select 1 from public.unit_conversions x
   where x.ingredient_id = i.id and x.unit_id = u.id
);

-- =====================================================================
-- DONE.
-- After running:
--   - Catalog should have 10 categories, 9 units, 23 ingredients,
--     ~12 unit_conversions.
--   - public.pantry_items should appear in the supabase_realtime
--     publication (Dashboard → Database → Publications).
-- =====================================================================
