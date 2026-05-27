-- =====================================================================
-- KitchenBase — Recipes draft migration
-- =====================================================================
-- Paste this file into the Supabase SQL Editor and click "Run".
-- It is idempotent (uses IF NOT EXISTS) and safe to re-run.
-- =====================================================================

alter table public.recipes
  add column if not exists is_draft boolean not null default false;

alter table public.recipes
  add column if not exists draft_step integer;

-- Helpful index for filtering drafts per user
create index if not exists idx_recipes_user_draft
  on public.recipes(user_id, is_draft);

-- (optional) add public.recipes to the realtime publication so REC-001
-- updates live across tabs without manual refetch.
do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'recipes'
  ) then
    alter publication supabase_realtime add table public.recipes;
  end if;
end$$;
