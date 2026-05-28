# KitchenBase — Foundational Setup Plan (Updated)

## 1) Objectives
- Deliver a **mobile-first React shell** with fixed design tokens (terracotta **#C2714F**, Playfair Display + Inter), **no shadows/gradients**. ✅ **Completed**
- Implement **Supabase Auth (email/password)** with session persistence, protected routing, and logout. ✅ **Completed**
- Provide a **complete Supabase SQL schema** (14 tables + constraints + indexes + RLS policies). ✅ **Delivered** / ✅ **Applied by user**
- Build **navigation skeleton** (TopBar + BottomTabBar + routes). ✅ **Completed**
- Build content-bearing flows on top of the skeleton:
  - **Despensa** (PAN-001 + MOD-001 + MOD-002). ✅ **Completed**
  - **Mis Recetas** (REC-001 + REC-002 wizard + REC-003 placeholder). ✅ **Completed**
- Provide **seed catalog data** required for Despensa to function. ✅ **Completed**
- Add **analytics event capture** for Despensa + Mis Recetas (PostHog), without PII. ✅ **Completed**
- Validate everything end-to-end with automated testing. ✅ **Completed (100% pass across iterations)**

---

## 2) Implementation Steps

### Phase 1 — Core Integration POC (Supabase Auth + minimal verification) ✅ Completed
_User stories_
1. As a visitor, I can open the app and see a Spanish welcome screen with “Iniciar sesión” and “Crear cuenta”. ✅
2. As a new user, I can register with email/password and receive a clear success/confirmation message. ✅
3. As a returning user, I can log in and stay logged in after a page refresh. ✅
4. As an unauthenticated visitor, I get redirected to the welcome screen when opening a protected route. ✅
5. As an authenticated user, I can log out and return to the welcome screen. ✅

_Steps (implemented)_
- Added frontend env vars: `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY` (existing env untouched). ✅
- Installed `@supabase/supabase-js`. ✅
- Created Supabase client singleton: `src/lib/supabaseClient.js`. ✅
- Built `AuthProvider` (`src/context/AuthContext.js`) with session restore + loading state + signUp/signIn/signOut. ✅
- Added route guards:
  - `ProtectedRoute` (`src/components/routing/ProtectedRoute.js`) ✅
  - `PublicOnlyRoute` (`src/components/routing/PublicOnlyRoute.js`) ✅
- Built auth UI (Spanish UI): Welcome / Login / Register with Spanish error mapping from Supabase errors. ✅

_Notes (important constraints discovered)_
- Supabase project has **email confirmations enabled**.
- Supabase rejects disposable/test domains like `@example.com` as invalid.
- For deterministic QA, a **pre-confirmed user** was created via Admin API and documented at `/app/memory/test_credentials.md`. ✅

---

### Phase 2 — V1 Foundational App Development (Shell UI + schema + navigation) ✅ Completed
_User stories_
1. As an authenticated user, I can navigate via bottom tabs to: Despensa, Mis Recetas, Biblioteca, Lista de la Compra, Descubrir. ✅
2. As an authenticated user, I can access Home via the top-left icon and Settings via the top-right icon. ✅
3. As an authenticated user, every non-built tab shows a consistent “Próximamente” placeholder using Playfair Display. ✅
4. As an authenticated user, I can clearly see which tab is active (terracotta) vs inactive (ink-secondary). ✅
5. As a user, the UI remains readable and well-spaced on 375–430px widths. ✅

_Steps (implemented)_
- Loaded Google Fonts in `public/index.html` (Playfair Display + Inter) and set `lang="es"`. ✅
- Configured Tailwind tokens in `tailwind.config.js`:
  - brand `#C2714F`, brand-light `#FDF3EF`
  - surface, ink, line
  - semaphore colors
  - 8px/12px radii
  - mobile-first type scale
  - no shadows ✅
- Built layout components:
  - `TopBar` (KitchenBase logo left → `/`, settings icon right → `/settings`) ✅
  - `BottomTabBar` (5 Spanish tabs, active terracotta) ✅
  - `AppLayout` wrapper ✅
  - `MobileFrame` to keep max width ~430px on desktop ✅
- Created placeholder pages (all show “Próximamente” + title in Playfair Display):
  - Home, Mis Recetas, Biblioteca, Lista de la Compra, Descubrir ✅
  - Settings is a real screen (account + logout). ✅
- Configured router map and redirects in `src/App.js`:
  - Public: `/welcome`, `/login`, `/register` ✅
  - Protected (AppLayout): `/`, `/pantry`, `/my-recipes`, `/library`, `/shopping-list`, `/discover`, `/settings` ✅
- Delivered complete schema file at `src/sql/schema.sql`:
  - 14 tables
  - FK + CHECK constraints (including XOR constraint for recipe_ingredients source)
  - uniqueness constraints (translations, library)
  - indexes
  - RLS enabled + policies per spec
  - idempotent (safe to re-run) ✅
- ✅ **Schema was pasted and applied by the user** in Supabase SQL Editor.

---

### Phase 3 — Despensa Flow (PAN-001 + MOD-001 + MOD-002) ✅ Completed
_User stories_
1. As an authenticated user, I can open the **Despensa** tab and see:
   - Empty state when no items exist
   - Otherwise, grouped pantry items with search and view toggles ✅
2. As a user, I can add an ingredient via a bottom-sheet modal (MOD-001). ✅
3. As a user, I can edit an existing pantry item via a bottom-sheet modal (MOD-002). ✅
4. As a user, I can delete a pantry item with a confirmation dialog (from swipe action or from MOD-002). ✅
5. As a user, search is **accent-insensitive and case-insensitive**. ✅
6. As a product owner, analytics events fire correctly without PII. ✅

_Steps (implemented)_
- Seed data files committed:
  - `frontend/src/sql/seed_despensa.sql` (full idempotent seed including DDL + data) ✅
  - `frontend/src/sql/despensa_ddl.sql` (DDL-only companion: unaccent + kb_norm + index + realtime publication add) ✅
- Seed catalog data applied programmatically via REST + service_role:
  - 10 ingredient_categories
  - 9 units
  - 23 ingredients (Spanish names, nutrition per 100g/100ml)
  - 12 unit_conversions ✅
- Implemented PAN-001 `PantryScreen`:
  - Sticky search bar (“Buscar en mi despensa…”) ✅
  - Segmented control: “Por ubicación” (default) / “Por categoría” ✅
  - Grouped collapsible sections, basics first, alphabetical ✅
  - Empty groups hidden ✅
  - Client-side search filter (accent- + case-insensitive) ✅
  - FAB “+” (aria-label “Añadir ingrediente”) opens MOD-001 ✅
  - Delete flow with confirmation dialog ✅
  - Realtime subscription to `pantry_items` (enhanced once realtime publication is enabled) ✅
- Implemented MOD-001 `AddPantryItemModal`:
  - Step 1: catalog search (debounced, client-side normalize) ✅
  - “Crear ingrediente nuevo …” sub-step inserts `user_ingredients` (pending) and shows an info banner; closes modal ✅
  - Step 2: quantity + unit selector (base + conversions) + location segmented + basic toggle ✅
  - Save inserts into `pantry_items`, closes, PAN-001 refreshes ✅
- Implemented MOD-002 `EditPantryItemModal`:
  - Title = ingredient name (Playfair Display, non-editable), subtitle = category ✅
  - Edit qty/unit/location/is_basic ✅
  - Actions: Guardar cambios / Cancelar / Eliminar (with confirmation) ✅
- Analytics wrapper added: `src/lib/analytics.js` (PII-stripping, no-op safe). ✅
  - Events captured:
    - `pantry_screen_viewed`
    - `pantry_view_mode_toggled` { mode }
    - `pantry_item_added` { ingredient_id, is_basic, location }
    - `pantry_item_edited` { ingredient_id }
    - `pantry_item_deleted` { ingredient_id }
    - `user_ingredient_created_in_pantry_flow` { proposed_name } ✅

_Bonus fix completed (later prompt)_
- MOD-001 UX: when “Marcar como básico” is ON, Cantidad and Unidad become **visually muted** (bg-surface-secondary, text-ink-secondary, cursor-not-allowed) and disabled; when OFF they return to normal. ✅

_Notes_
- MOD-001 catalog search is client-side (using `normalize()`), so Despensa works even if `unaccent/kb_norm` aren’t enabled yet.
- Realtime updates across sessions/tabs are fully supported once `public.pantry_items` is in `supabase_realtime` publication.

_Remaining one-time user action (optional enhancement)_
- Paste and run `frontend/src/sql/despensa_ddl.sql` in Supabase SQL Editor. ⏳
  - Enables: `unaccent`, `kb_norm()`, functional index `idx_ingredients_name_norm`
  - Adds `public.pantry_items` to `supabase_realtime` publication
  - **App already works without it**; this improves future DB-level search and realtime robustness.

---

### Phase 4 — Mis Recetas Flow (REC-001 + REC-002 + REC-003 placeholder) ✅ Completed
_User stories_
1. As an authenticated user, I can open **Mis Recetas** and see an empty state if I have no recipes. ✅
2. As a user, I can create a recipe using a **5-step wizard** that saves a **persistent draft** as I progress. ✅
3. As a user, I can leave the wizard mid-way and later **resume** from the last saved step. ✅
4. As a user, I can add ingredients (including quarantined user_ingredients) and mark key ingredients. ✅
5. As a user, I can add preparation steps and finalize the recipe. ✅
6. As a user, the wizard hides the bottom tab bar and shows a wizard-specific header. ✅
7. As a product owner, analytics events fire correctly without PII. ✅

_Database changes (applied by user)_
- Migration SQL committed: `frontend/src/sql/recipes_draft_migration.sql` ✅
- User applied via Supabase SQL Editor:
  - `recipes.is_draft boolean not null default false`
  - `recipes.draft_step integer`
  - index `idx_recipes_user_draft (user_id, is_draft)`
  - `public.recipes` added to `supabase_realtime` publication ✅

_REC-001 — MyRecipesScreen_
- Sticky search bar “Buscar en mis recetas…” with accent/case-insensitive client filter ✅
- List ordered by `created_at desc`, realtime subscription on user recipes ✅
- Cards:
  - Completed: “NN min · Fácil/Media/Difícil · N raciones” + status pill “Privada” / “Propuesta” (subtle border) ✅
  - Draft: “En borrador · paso N de 5” + pill “Borrador” (`bg-brand-light text-brand`) ✅
- FAB “Crear receta” → `/my-recipes/new` ✅
- Long-press / context-menu delete → confirmation → DELETE `recipes` (cascade) ✅
- Empty state with CTA “Crear mi primera receta” ✅

_REC-002 — RecipeWizardScreen (full-screen, persistent drafts)_
- Full-screen outside `AppLayout` so bottom tab bar is hidden ✅
- Wizard header: X close + “Paso N de 5” + terracotta progress bar ✅
- Step 1 (Title): creates draft on first “Siguiente” (INSERT), later updates (UPDATE) ✅
- Step 2 (Difficulty + time): segmented control + time input with “min” suffix; saves on “Siguiente” ✅
- Step 3 (Servings): stepper 1–20; saves on “Siguiente” ✅
- Step 4 (Ingredients):
  - Live persistence: add/remove/toggle key updates `recipe_ingredients` immediately ✅
  - Recomputes `recipes.has_pending_ingredients` after each change ✅
  - “Añadir ingrediente” opens AddRecipeIngredientModal (no location/basic; has is_key; supports quarantined) ✅
- Step 5 (Steps): batch save on “Guardar receta” (replaces recipe_steps) ✅
- Finalize: sets `is_draft=false`, `draft_step=null`, computes per-serving nutrition from catalog ingredients using `unit_conversions`, excludes quarantined ingredients ✅
- Close confirmation dialog varies based on whether a draft exists; tracks abandonment analytics ✅
- Resume mode `/my-recipes/edit/:id`: loads recipe + ingredients + steps, jumps to `draft_step` ✅
- If opened on non-draft recipe: shows “Edición de recetas completadas — próximamente” placeholder ✅

_REC-003 placeholder route_
- `/my-recipes/:id` renders `ComingSoon` with title “Detalle de receta”. ✅
- If the recipe is a draft, it redirects to `/my-recipes/edit/:id`. ✅

_Utilities / shared components added_
- `src/lib/recipeNutrition.js` computes kcal/protein/carbs/fat/fiber per serving (partial if quarantined ingredients exist). ✅
- Hydration warning fix: unit `<option>` rendered as a single template literal to avoid invalid DOM nesting in Emergent wrapper. ✅

_Analytics events (recipes)_
- `my_recipes_screen_viewed`
- `recipe_wizard_started`
- `recipe_wizard_resumed` { from_step }
- `recipe_wizard_step_completed` { step }
- `recipe_wizard_saved` { step_count, ingredient_count, has_pending_ingredients }
- `recipe_wizard_abandoned` { last_step }
- `recipe_deleted_from_list` { was_draft } ✅

---

### Phase 5 — Testing & Stabilization ✅ Completed
_Testing_
- `testing_agent_v3` iteration 1 (foundation): **100% pass**, **0 bugs**.
  - Report: `/app/test_reports/iteration_1.json` ✅
- `testing_agent_v3` iteration 2 (Despensa): **100% pass**, **0 critical bugs**.
  - Report: `/app/test_reports/iteration_2.json` ✅
- `testing_agent_v3` iteration 3 (Mis Recetas + MOD-001 UX fix): **100% pass**, **0 critical bugs**.
  - Report: `/app/test_reports/iteration_3.json` ✅
  - Minor hydration warning reported there was fixed afterwards. ✅

_Known minor test-only note_
- The platform “Made with Emergent” badge can intercept pointer events in automated tests, occasionally requiring force-click. Low priority; not a real user issue.

---

### Phase 6 — Pantry Quarantine + Semaphore Engine + Detail screens ✅ Completed
_See git history for P1 / P1.5 / P2 / P3 deliverables._

---

### Phase 7 — Biblioteca (LIB-001 + LIB-002) ✅ Completed
_User stories_
1. As an authenticated user, I can open the **Biblioteca** tab and see all my saved recipes with a traffic-light indicator (green/yellow/orange). ✅
2. As a user, the list is ordered by semaphore color (green first, then yellow, then orange) — no headers. ✅
3. As a user, each card displays the semaphore dot + stripe, time, difficulty, and (only when not green) "Faltan N ingredientes" with correct singular/plural. ✅
4. As a user, I can long-press a card to remove a recipe from my library with a confirmation dialog. ✅
5. As a user, tapping a card opens the **library detail** screen for that recipe. ✅
6. As a user, the detail screen shows a large semaphore banner driven by the engine (`compute_recipe_status` RPC). ✅
7. As a user, ingredients that I'm missing are highlighted distinctly (orange row for missing key, yellow row for missing non-key) with a "Te falta" badge and missing quantity (in base unit). ✅
8. As a user, the detail screen renders disabled "Próximamente" CTAs for **Añadir a la Lista de la Compra** and **He cocinado esto**. ✅
9. As a user with an empty library, I see two active CTAs: "Añade tu primera receta" → wizard, "Explora el catálogo" → /discover. ✅
10. As a product owner, analytics events fire correctly without PII. ✅

_Engine consumption (strict constraint per D-008)_
- Traffic-light logic is NEVER computed client-side.
- LIB-001 calls `rpc('compute_library_status', { p_user_id })`.
- LIB-002 calls `rpc('compute_recipe_status', { p_recipe_id, p_user_id })`.
- Missing-ingredient highlighting is driven exclusively by the RPC's `missing_ingredients` JSONB array (matched by `ingredient_id` for catalog or `user_ingredient_id` for quarantine).

_Files added / modified_
- `frontend/src/screens/LibraryScreen.js` — LIB-001 ✅
- `frontend/src/screens/LibraryRecipeDetailScreen.js` — LIB-002 ✅
- `frontend/src/components/library/LibraryRecipeCard.js` — list card with semaphore + missing-count ✅
- `frontend/src/components/library/EmptyLibraryState.js` — dual-CTA empty state ✅
- `frontend/src/components/library/SemaphoreIndicator.js` — SemaphoreDot, SemaphoreStripe, SemaphoreBanner ✅
- `frontend/src/App.js` — added route `/library/:id` ✅

_Analytics events_
- `library_viewed` — fired on LIB-001 load with `{ recipe_count, green_count, yellow_count, orange_count }` ✅
- `library_recipe_opened` — fired when navigating LIB-001 → LIB-002 with `{ recipe_id, status }` ✅
- `library_recipe_removed` — fired after successful removal with `{ recipe_id }` ✅

_Out of scope for P4 (deliberately deferred)_
- Shopping List flow (SHO-001 + MOD-004 + MOD-005) — buttons are "Próximamente".
- "He cocinado esto" cooking history (MOD-003) — button is "Próximamente".

---

### Phase 7.1 — Verification closure (P4.1) ✅ Completed
_What was missing in P4: the E2E test ran with ONLY orange recipes in the
test user's library, so cross-color behavior (green / yellow / green+pending)
was never exercised._

_Test data seeded (idempotent, all tagged `P4.1-seed`):_
- `tests/seed_p4_1_multicolor.py` — seeds 3 recipes + necessary pantry rows.
- `tests/seed_p4_1_cleanup.py` — removes the 3 recipes + the quarantine ingredient.

All 9 verification items PASSED. Trivial `LibraryRecipeCard.js` test-id namespacing applied.

---

### Phase 8 — Lista de la Compra (SHO-001 + MOD-004 + MOD-005 + LIB-002 CTA) ✅ Completed
_User stories_
1. As an authenticated user, I can open the **Lista de la Compra** tab and see my items (unchecked first, checked at the bottom). ✅
2. As a user, an empty list shows an explanatory message + a "Ir a mi Biblioteca" CTA. ✅
3. As a user, tapping a checkbox opens **MOD-004 (Confirmar Cantidad Comprada)** pre-filled with the needed quantity. ✅
4. As a user, confirming MOD-004 (a) ADDS the bought quantity to my pantry (creating or incrementing the catalog row), and (b) marks the item bought (`is_checked=true`, `bought_quantity`, `checked_at`). ✅
5. As a user, manually adding an item via **MOD-005** searches the catalog only — quarantine ingredients are not offered here. ✅
6. As a user, "Compartir lista" opens the OS native share where available, or copies a readable plain-text list to the clipboard otherwise. ✅
7. As a user, "Vaciar lista" requires explicit confirmation before deleting all my items. ✅
8. As a user on **LIB-002**, the previously disabled "Añadir lo que falta a la Lista de la Compra" CTA is now active when the recipe has missing ingredients; it writes the missing CATALOG entries to my list, applying the consolidation rule. ✅
9. As a user, when a recipe's missing set includes a quarantine ingredient, that one is **skipped** and a calm caption explains it ("Algunos ingredientes pendientes de validar no se pueden añadir a la lista todavía."). No schema violation, no error. ✅
10. As a user, "He cocinado esto" remains disabled / "Próximamente" — out of scope for P5 (MOD-003). ✅

_Critical data-model constraint observed_
- `shopping_list_items.ingredient_id` is **NOT NULL** and references the global catalog only. Quarantine ingredients (`user_ingredient_id`) cannot be added — they are skipped at the source.
- Quantities are stored in the ingredient's **base unit**. Conversions go through the shared server-side `kb_convert_to_base` function (no client-side reimplementation).

_Files added_
- `frontend/src/screens/ShoppingListScreen.js` — SHO-001 (replaced the placeholder). ✅
- `frontend/src/components/shopping/ShoppingListItem.js` — single-row component. ✅
- `frontend/src/components/shopping/EmptyShoppingListState.js` — empty-state. ✅
- `frontend/src/components/shopping/ConfirmBoughtModal.js` — MOD-004. ✅
- `frontend/src/components/shopping/AddShoppingItemModal.js` — MOD-005. ✅
- `frontend/src/lib/unitConversion.js` — `convertToBase()` + `loadIngredientUnits()` helpers calling `kb_convert_to_base` RPC. ✅

_Files modified_
- `frontend/src/screens/LibraryRecipeDetailScreen.js` — `ComingSoonActions` → `RecipeActions`: shopping CTA active when there are missing ingredients; "He cocinado esto" untouched (still disabled). ✅

_Consolidation rule (verified live)_
- An UNCHECKED row for the same `ingredient_id` is **summed**, not duplicated.
- A CHECKED row is never modified — a new unchecked row is created instead.
- Manual add (MOD-005) and "Añadir lo que falta" (LIB-002) both share this rule.
- Live evidence: before "50 g Pechuga de pollo (unchecked)" + Paella missing 300 g → after "350 g Pechuga de pollo (unchecked)" — one row, summed.

_Critical full loop verified end-to-end_
- LIB-002 (orange) → CTA → SHO-001 (50 g Pechuga) → MOD-004 (confirm 100 g) → pantry 400→500 g → engine recomputes Paella → **green**. The shopping list closes the loop back to the pantry.

_Analytics events_
- `shopping_list_viewed` — fired on SHO-001 mount with `{ item_count }`. ✅
- `shopping_item_added_manual` — fired on MOD-005 add with `{ ingredient_id }`. ✅
- `shopping_item_checked` — fired on MOD-004 confirm with `{ ingredient_id }`. ✅
- `shopping_list_cleared` — fired on "Vaciar lista" confirm with `{ cleared_count }`. ✅
- `missing_ingredients_added_to_list` — fired on LIB-002 CTA with `{ recipe_id, added_count, skipped_pending_count }`. ✅

_Out of scope for P5 (deliberately deferred)_
- MOD-003 / "He cocinado esto" cooking history.

---

### Phase 9 — Future prompts (Out of scope now)
- **REC-003** full recipe detail screen (display nutrition, ingredients, steps, key ingredients, etc.)
- Editing already-completed recipes (private/proposed/public flows per decision D-028)
- Biblioteca (saved community recipes)
- Lista de la Compra (including generation from recipes)
- Descubrir (community feed)
- Traffic-light (semaphore) recipe classification logic
- Admin panel for ingredient validation
- Translations runtime usage
- Push notifications

---

## 3) Next Actions
1. ✅ Schema applied.
2. ✅ Recipes draft migration applied.
3. ✅ Pantry quarantine + semaphore engine migrations applied.
4. ✅ Biblioteca (P4) shipped.
5. Continue with the next flow prompt (recommended order):
   1) **SHO-001 Lista de la Compra** (replaces the "Próximamente" CTA in LIB-002) → 2) MOD-003 "He cocinado esto" → 3) DIS-001 Descubrir → 4) D-028 Edit completed recipes with versioning.

---

## 4) Success Criteria
- Auth: signup/login/logout works; session persists across reloads; protected routes redirect correctly. ✅
- UI: 100% Spanish user-facing text; consistent tokens; mobile-first layout (375–430px) with no shadows/gradients. ✅
- Navigation: TopBar + BottomTabBar present on all protected screens; correct active tab styling. ✅
- Database: `schema.sql` creates all 14 tables with correct constraints, indexes, and RLS policies. ✅ **Applied**
- Despensa: PAN-001 + MOD-001 + MOD-002 work end-to-end with Supabase persistence, accent-insensitive search, delete confirmations, and analytics events. ✅
- Mis Recetas: REC-001 list + REC-002 5-step wizard drafts/resume + REC-003 placeholder route work end-to-end with Supabase persistence and analytics events. ✅
- QA: automated testing confirms foundation + Despensa + Mis Recetas with 100% pass. ✅
