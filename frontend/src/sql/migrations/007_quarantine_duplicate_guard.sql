-- 007_quarantine_duplicate_guard.sql
-- Server-side guard: prevents inserting a user_ingredients row whose
-- normalized name already exists either in the global catalog or in the
-- same user's quarantine. Defense in depth — the frontend also guards
-- this, but a database-level check ensures correctness even if the
-- frontend has a bug.
--
-- Implements decision D-031.

create or replace function public.check_user_ingredient_uniqueness()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_normalized text;
begin
  v_normalized := lower(trim(new.name));

  -- Reject if the name matches a catalog ingredient (normalized)
  if exists (
    select 1 from public.ingredients
    where lower(trim(name)) = v_normalized
  ) then
    raise exception 'Ingredient "%" already exists in the global catalog. Select it from search results instead.', new.name
      using errcode = 'unique_violation';
  end if;

  -- Reject if the same user already has this name in quarantine
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
end$$;

drop trigger if exists trg_user_ingredient_uniqueness on public.user_ingredients;
create trigger trg_user_ingredient_uniqueness
  before insert or update of name on public.user_ingredients
  for each row
  execute function public.check_user_ingredient_uniqueness();
