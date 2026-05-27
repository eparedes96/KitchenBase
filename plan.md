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

### Phase 6 — Future prompts (Out of scope now)
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
3. **(Optional enhancement — recommended)** Apply Despensa DDL in Supabase:
   - Supabase Dashboard → Project `ldrxurbtrbjhxmrpdtjr` → SQL Editor → New query
   - Paste `frontend/src/sql/despensa_ddl.sql`
   - Click **Run**
4. Continue with the next flow prompt (recommended order):
   1) **REC-003 Detalle de receta** → 2) Lista de la Compra → 3) Biblioteca → 4) Descubrir.

---

## 4) Success Criteria
- Auth: signup/login/logout works; session persists across reloads; protected routes redirect correctly. ✅
- UI: 100% Spanish user-facing text; consistent tokens; mobile-first layout (375–430px) with no shadows/gradients. ✅
- Navigation: TopBar + BottomTabBar present on all protected screens; correct active tab styling. ✅
- Database: `schema.sql` creates all 14 tables with correct constraints, indexes, and RLS policies. ✅ **Applied**
- Despensa: PAN-001 + MOD-001 + MOD-002 work end-to-end with Supabase persistence, accent-insensitive search, delete confirmations, and analytics events. ✅
- Mis Recetas: REC-001 list + REC-002 5-step wizard drafts/resume + REC-003 placeholder route work end-to-end with Supabase persistence and analytics events. ✅
- QA: automated testing confirms foundation + Despensa + Mis Recetas with 100% pass. ✅
