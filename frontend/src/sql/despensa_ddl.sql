-- =====================================================================
-- KitchenBase — Despensa DDL (paste-once)
-- =====================================================================
-- The catalog data (categories, units, ingredients, unit_conversions)
-- was already applied via the Admin REST API.
-- This file contains ONLY the DDL bits that the REST API cannot apply.
--
-- Paste this into the Supabase SQL Editor and click "Run".
-- =====================================================================

-- 1) Extensions
create extension if not exists unaccent;

-- 2) Normalization helper (immutable so it can be indexed)
create or replace function public.kb_norm(value text)
  returns text
  language sql
  immutable
  parallel safe
as $$
  select lower(unaccent(coalesce(value, '')));
$$;

-- Functional index to make `kb_norm(name) ilike ...` fast
create index if not exists idx_ingredients_name_norm
  on public.ingredients (public.kb_norm(name));

-- 3) Add pantry_items to the realtime publication
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
