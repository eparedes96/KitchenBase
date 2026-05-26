# KitchenBase — Foundational Setup Plan (Updated)

## 1) Objectives
- Deliver a **mobile-first React shell** with fixed design tokens (terracotta **#C2714F**, Playfair Display + Inter), **no shadows/gradients**. ✅ **Completed**
- Implement **Supabase Auth (email/password)** with session persistence, protected routing, and logout. ✅ **Completed**
- Provide a **complete Supabase SQL schema** (14 tables + constraints + indexes + RLS policies) ready to paste into Supabase SQL Editor. ✅ **Schema delivered** / ⏳ **User must apply to Supabase once**
- Build **navigation skeleton** (TopBar + BottomTabBar + routes) where **every screen shows “Próximamente”** placeholders (Spanish UI only). ✅ **Completed**
- Validate the foundational build end-to-end with automated testing. ✅ **Completed (100% pass)**

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


### Phase 2 — V1 Foundational App Development (Skeleton UI + schema + navigation) ✅ Completed (except schema application)
_User stories_
1. As an authenticated user, I can navigate via bottom tabs to: Despensa, Mis Recetas, Biblioteca, Lista de la Compra, Descubrir. ✅
2. As an authenticated user, I can access Home via the top-left icon and Settings via the top-right icon. ✅
3. As an authenticated user, every screen shows a consistent “Próximamente” placeholder using Playfair Display. ✅
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
  - Home, Despensa, Mis Recetas, Biblioteca, Lista de la Compra, Descubrir, Ajustes ✅
- Configured router map and redirects in `src/App.js`:
  - Public: `/welcome`, `/login`, `/register` ✅
  - Protected: `/`, `/pantry`, `/my-recipes`, `/library`, `/shopping-list`, `/discover`, `/settings` ✅
- Delivered complete schema file at `src/sql/schema.sql`:
  - 14 tables
  - FK + CHECK constraints (including XOR constraint for recipe_ingredients source)
  - uniqueness constraints (translations, library)
  - indexes
  - RLS enabled + policies per spec
  - idempotent (safe to re-run) ✅

_Remaining one-time user action (required)_
- Apply the schema to the Supabase project (manual paste/run in SQL Editor).
  - Reason: programmatic application is blocked (no `exec_sql` RPC, Management API requires PAT, pg-meta not exposed, DB connection URI/password not provided).


### Phase 3 — Testing & Stabilization (End-to-end) ✅ Completed
_User stories_
1. As a user, I can complete register/login/logout without errors or broken states. ✅
2. As a user, I never see English UI strings. ✅
3. As a user, navigation never loses the persistent top/bottom bars on protected screens. ✅
4. As a user, reloading any protected route keeps me signed in (if session exists). ✅
5. As a developer, I can paste `schema.sql` into Supabase and see all tables + RLS enabled. ⏳ (blocked until schema is applied)

_Testing_
- `testing_agent_v3` iteration 1: **100% pass**, **0 bugs**, **no Supabase/env console errors**.
- Report: `/app/test_reports/iteration_1.json`. ✅


### Phase 4 — Future prompts (Out of scope now)
- Pantry CRUD
- Recipe creation/editing
- Traffic-light (semaphore) logic
- Shopping list functionality
- Discover/community features
- Admin role and admin panel
- Translations runtime usage
- Push notifications

## 3) Next Actions
1. **(User action — required)** Apply the schema in Supabase:
   - Supabase Dashboard → Project `ldrxurbtrbjhxmrpdtjr` → SQL Editor → New query
   - Paste `/app/frontend/src/sql/schema.sql`
   - Click **Run**
   - Verify **14 tables** appear in Table Editor and show the **RLS shield**.
2. (Optional for QA) Use the documented pre-confirmed test user from `/app/memory/test_credentials.md` to validate auth flows quickly.
3. Proceed with future prompts, one flow at a time (Despensa → Recetas → Lista de la Compra → Descubrir), building on this skeleton.

## 4) Success Criteria
- Auth: signup/login/logout works; session persists across reloads; protected routes redirect correctly. ✅
- UI: 100% Spanish user-facing text; consistent tokens; mobile-first layout (375–430px) with no shadows/gradients. ✅
- Navigation: TopBar + BottomTabBar present on all protected screens; correct active tab styling. ✅
- Database: `schema.sql` creates all 14 tables with correct constraints, indexes, and RLS policies matching the spec. ⏳ **Pending user application step**
- QA: Testing agent confirms all foundational user stories end-to-end with no console errors. ✅
