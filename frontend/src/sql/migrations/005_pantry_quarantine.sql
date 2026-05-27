-- 005_pantry_quarantine.sql
-- Allows pantry_items to reference either a catalog ingredient (ingredient_id)
-- or a quarantined user ingredient (user_ingredient_id), via XOR constraint.
-- Implements decision D-029 (revises D-009).

-- Step 1: Make ingredient_id nullable
alter table public.pantry_items
  alter column ingredient_id drop not null;

-- Step 2: Add user_ingredient_id (nullable FK to user_ingredients)
alter table public.pantry_items
  add column if not exists user_ingredient_id uuid
  references public.user_ingredients(id) on delete cascade;

-- Step 3: Add XOR constraint (exactly one of the two FKs must be non-null)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'pantry_items'
      and constraint_name = 'pantry_items_one_source'
  ) then
    alter table public.pantry_items
      add constraint pantry_items_one_source check (
        (ingredient_id is not null and user_ingredient_id is null)
        or
        (ingredient_id is null and user_ingredient_id is not null)
      );
  end if;
end$$;

-- Step 4: Index for new column
create index if not exists idx_pantry_items_user_ingredient
  on public.pantry_items(user_ingredient_id)
  where user_ingredient_id is not null;

-- Step 5: RLS — ensure a user can only reference user_ingredients they created.
-- The existing pantry_items_all_owner policy already restricts by user_id.
-- Add an additional CHECK at row level to ensure user_ingredient_id (if set)
-- belongs to the same user. Implemented as a trigger because RLS WITH CHECK
-- cannot easily reference another table's row.

create or replace function public.check_pantry_user_ingredient_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
end$$;

drop trigger if exists trg_pantry_user_ingredient_ownership on public.pantry_items;
create trigger trg_pantry_user_ingredient_ownership
  before insert or update on public.pantry_items
  for each row
  execute function public.check_pantry_user_ingredient_ownership();
