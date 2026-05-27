-- cleanup_001_quarantine_duplicates.sql
-- One-off cleanup for existing duplicate user_ingredients that shadow
-- catalog ingredients. NOT a recurring migration.
--
-- For each user_ingredient whose normalized name (trim + lowercase) matches
-- an ingredient in the global catalog, we:
--   1. Reassign any recipe_ingredients references to the catalog ingredient.
--   2. Reassign any pantry_items references to the catalog ingredient.
--   3. Delete the now-orphaned user_ingredient.
--
-- This is wrapped in a single transaction so partial failures don't corrupt data.

begin;

-- Step 1: Identify duplicates. We use a CTE to find all user_ingredients
-- whose normalized name matches a catalog ingredient.
with duplicates as (
  select
    ui.id as user_ingredient_id,
    i.id as catalog_ingredient_id,
    ui.name as quarantine_name,
    i.name as catalog_name
  from public.user_ingredients ui
  join public.ingredients i
    on lower(trim(ui.name)) = lower(trim(i.name))
  where ui.status in ('pending', 'rejected')
),

-- Step 2: Reassign recipe_ingredients to point to the catalog ingredient.
ri_updated as (
  update public.recipe_ingredients ri
  set
    ingredient_id = d.catalog_ingredient_id,
    user_ingredient_id = null
  from duplicates d
  where ri.user_ingredient_id = d.user_ingredient_id
  returning ri.id
),

-- Step 3: Reassign pantry_items to point to the catalog ingredient.
-- If a pantry_item already exists for this user+catalog ingredient (rare
-- but possible), the duplicate user_ingredient reference is DELETED instead
-- of reassigned, to respect the implicit uniqueness of pantry_items per user.
pi_to_delete as (
  select pi.id
  from public.pantry_items pi
  join duplicates d on pi.user_ingredient_id = d.user_ingredient_id
  where exists (
    select 1 from public.pantry_items pi2
    where pi2.user_id = pi.user_id
      and pi2.ingredient_id = d.catalog_ingredient_id
  )
),
pi_deleted as (
  delete from public.pantry_items
  where id in (select id from pi_to_delete)
  returning id
),
pi_updated as (
  update public.pantry_items pi
  set
    ingredient_id = d.catalog_ingredient_id,
    user_ingredient_id = null
  from duplicates d
  where pi.user_ingredient_id = d.user_ingredient_id
    and not exists (
      select 1 from public.pantry_items pi2
      where pi2.user_id = pi.user_id
        and pi2.ingredient_id = d.catalog_ingredient_id
        and pi2.id <> pi.id
    )
  returning pi.id
),

-- Step 4: Delete the now-orphaned user_ingredients.
ui_deleted as (
  delete from public.user_ingredients ui
  using duplicates d
  where ui.id = d.user_ingredient_id
  returning ui.id, ui.name
)

-- Final report
select
  'Cleanup complete' as status,
  (select count(*) from duplicates) as duplicates_found,
  (select count(*) from ri_updated) as recipe_ingredients_reassigned,
  (select count(*) from pi_deleted) as pantry_items_deleted,
  (select count(*) from pi_updated) as pantry_items_reassigned,
  (select count(*) from ui_deleted) as user_ingredients_deleted;

commit;
