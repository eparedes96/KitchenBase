# KitchenBase

Asistente de cocina doméstica con un **bucle cerrado**:
**Despensa → Semáforo de recetas → Lista de la compra → Despensa**.
Conecta el inventario, el recetario y la lista de la compra para responder a
"¿qué cocino hoy con lo que tengo?" y reducir el desperdicio de alimentos.

> **Estado**: prototipo funcional (Ola 1 — MVP). En transición de Emergent a
> desarrollo con Claude Code (el destino definitivo es React Native + Expo).
> Los 5 flujos críticos del MVP están completos y el bucle cierra de punta a punta.

## Stack
- **Frontend**: React 19 + React Router 7, Tailwind CSS + shadcn/ui (Radix), build con CRA + craco.
- **Backend de datos**: Supabase (PostgreSQL + Auth + RLS + Realtime). El frontend habla directamente con Supabase; no hay servidor propio en el bucle.
- **Analytics**: PostHog (vía wrapper, sin datos personales).

## Estructura
```
frontend/            App React (todo el producto vive aquí)
  src/
    screens/         Una pantalla por ruta
    components/      UI por dominio (pantry, recipes, library, shopping, cooking, layout, common, ui)
    context/         AuthContext (sesión Supabase)
    lib/             supabaseClient, analytics, conversiones, utils
    sql/             schema.sql (snapshot vivo) + migrations/
docs/                STYLEGUIDE.md (convenciones de código)
backend/             Boilerplate de Emergent (FastAPI + MongoDB) — VESTIGIAL, no se usa
CLAUDE.md            Memoria de proyecto para Claude Code (reglas de oro)
plan.md              Bitácora de implementación por fases
```

## Arranque (desarrollo)
Requiere **Node.js LTS**.
```bash
corepack enable          # habilita yarn 1.22 (fijado en package.json)
cd frontend
yarn install
yarn start               # servidor de desarrollo (craco)
```
Crea `frontend/.env` (no versionado) con:
```
REACT_APP_SUPABASE_URL=...
REACT_APP_SUPABASE_ANON_KEY=...
```

Otros scripts: `yarn build` (producción), `yarn test`, `yarn format` / `yarn format:check` (Prettier).

## Base de datos
- Esquema autoritativo: `frontend/src/sql/schema.sql` (snapshot de la BD viva tras las migraciones 001-010). Migraciones incrementales en `frontend/src/sql/migrations/`.
- **13 tablas**, RLS activado en todas. El **semáforo se calcula en servidor** mediante funciones PL/pgSQL (RPC); nunca en cliente.

## Documentación
- **`CLAUDE.md`** — reglas de oro y contexto para trabajar en el proyecto.
- **`docs/STYLEGUIDE.md`** — convenciones de código.
- **Documentos de diseño** (fuera del repo, en OneDrive `…/KitchenBase/Documentación/`): PRD, Modelo de Datos, Mapa de Pantallas, Registro de Decisiones, Guía de Estilo y deuda técnica.

## Convenciones
**App en español, código en inglés.** Ver `CLAUDE.md` y `docs/STYLEGUIDE.md`.
