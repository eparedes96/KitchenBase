# KitchenBase — Foundational Setup Plan

## 1) Objectives
- Deliver a **mobile-first React shell** with fixed design tokens (terracotta #C2714F, Playfair Display + Inter), **no shadows/gradients**.
- Implement **Supabase Auth (email/password)** with session persistence, protected routing, and logout.
- Provide a **complete Supabase SQL schema** (14 tables + constraints + indexes + RLS policies) ready to paste into Supabase SQL Editor.
- Build **navigation skeleton** (TopBar + BottomTabBar + routes) where **every screen shows “Próximamente”** placeholders (Spanish UI only).

## 2) Implementation Steps

### Phase 1 — Core Integration POC (Supabase Auth + minimal RLS verification)
_User stories_
1. As a visitor, I can open the app and see a Spanish welcome screen with “Iniciar sesión” and “Crear cuenta”.
2. As a new user, I can register with email/password and receive a clear success/confirmation message.
3. As a returning user, I can log in and stay logged in after a page refresh.
4. As an unauthenticated visitor, I get redirected to the welcome screen when opening a protected route.
5. As an authenticated user, I can log out and return to the welcome screen.

_Steps_
- Add frontend env vars: `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY` (leave existing env untouched).
- Install `@supabase/supabase-js`.
- Create `src/lib/supabaseClient.js` singleton.
- Build `AuthProvider` (restore session, loading state, signUp/signIn/signOut).
- Add `ProtectedRoute` and `PublicRoute` for React Router v7.
- Create minimal Welcome / Login / Register screens (Spanish copy; code identifiers in English).
- Quick verification: sign up → sign in → refresh persists → sign out.

### Phase 2 — V1 Foundational App Development (Skeleton UI + schema + navigation)
_User stories_
1. As an authenticated user, I can navigate via bottom tabs to: Despensa, Mis Recetas, Biblioteca, Lista de la Compra, Descubrir.
2. As an authenticated user, I can access Home via the top-left icon and Settings via the top-right icon.
3. As an authenticated user, every screen shows a consistent “Próximamente” placeholder using Playfair Display.
4. As an authenticated user, I can clearly see which tab is active (terracotta) vs inactive (text-secondary).
5. As a user, the UI remains readable and well-spaced on 375–430px widths.

_Steps_
- Add Google Fonts in `public/index.html` (Playfair Display + Inter).
- Configure Tailwind tokens (colors, fontFamily, radii) and enforce “no shadows/gradients” via component usage.
- Create UI primitives usage guidelines (shadcn/ui) without hardcoded colors (use token classes).
- Build layout components:
  - `TopBar` (Home left, Settings right)
  - `BottomTabBar` (5 tabs, active/inactive states)
  - `AppLayout` wrapper
- Create placeholder pages:
  - Home, Despensa, MisRecetas, Biblioteca, ListaCompra, Descubrir, Settings
- Configure router map and redirects:
  - Public: `/welcome`, `/login`, `/register`
  - Protected: `/`, `/pantry`, `/my-recipes`, `/library`, `/shopping-list`, `/discover`, `/settings`
- Generate `src/sql/schema.sql`:
  - 14 tables + FK constraints + CHECK constraints (notably recipe_ingredients XOR ingredient_id/user_ingredient_id)
  - uniqueness constraints (translations, library)
  - indexes on FK/user_id/status fields
  - enable RLS + policies per spec
  - catalog tables: authenticated SELECT only; writes service-role only

### Phase 3 — Testing & Stabilization (End-to-end)
_User stories_
1. As a user, I can complete register/login/logout without errors or broken states.
2. As a user, I never see English UI strings.
3. As a user, navigation never loses the persistent top/bottom bars on protected screens.
4. As a user, reloading any protected route keeps me signed in (if session exists).
5. As a developer, I can paste `schema.sql` into Supabase and see all tables + RLS enabled.

_Steps_
- Run one full E2E pass with testing agent against the 10 foundational user stories.
- Fix routing/auth edge cases (loading flashes, redirect loops, error messaging in Spanish).
- Validate console is clean (no missing env, no Supabase init errors).

### Phase 4 — Future prompts (Out of scope now)
- Implement feature flows one-by-one: pantry CRUD, recipe CRUD, traffic-light logic, shopping list, discover/community.

## 3) Next Actions
1. Create `plan.md` in repo with this plan.
2. Start Phase 1: add env vars + install Supabase client + implement AuthProvider + basic auth screens.
3. Once Phase 1 is stable, proceed to Phase 2: design tokens + navigation shell + placeholder pages + `schema.sql`.
4. Run Phase 3 testing agent and iterate until all success criteria pass.

## 4) Success Criteria
- Auth: signup/login/logout works; session persists across reloads; protected routes redirect correctly.
- UI: 100% Spanish user-facing text; consistent tokens; mobile-first layout (375–430px) with no shadows/gradients.
- Navigation: TopBar + BottomTabBar present on all protected screens; correct active tab styling.
- Database: `schema.sql` creates all 14 tables with correct constraints, indexes, and RLS policies matching the spec.
- QA: Testing agent confirms all foundational user stories end-to-end with no console errors.
