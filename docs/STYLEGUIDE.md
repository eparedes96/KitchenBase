# KitchenBase — Guía de Estilo de Código

> Convenciones de **código** (las que las herramientas externas no imponen).
> El estilo **visual/UX** vive en `Documentación/` (Doc 5). Las reglas de oro del
> proyecto están en `CLAUDE.md`.

## Idioma
- **Código en inglés, app en español.** Identificadores, nombres de tablas/funciones,
  comentarios y mensajes de commit en **inglés**. Todo texto visible para el usuario, en **español**.

## Formato y linting (automático)
- **Prettier** impone el formato. No discutir estilo a mano.
  - `cd frontend && yarn format` (escribe) · `yarn format:check` (verifica).
  - Config en `frontend/.prettierrc`: comillas dobles, `;`, coma final `all`, ancho 80, 2 espacios.
- **ESLint** (vía CRACO, con `react-hooks/recommended`) corre en `yarn start`/`build`.
  `eslint-config-prettier` desactiva las reglas de formato que chocan con Prettier.

## Nomenclatura
**Base de datos** (ver Doc 2 §1.1 — fuente canónica):
- Tablas en minúscula y **plural** (`recipe_ingredients`). PK siempre `id` (UUID).
- FK con patrón `<tabla_singular>_id` (`recipe_id`, `user_id`).
- Fechas en UTC con `timestamptz`. Booleanos con prefijo `is_` / `has_` (`is_key`, `has_pending_ingredients`).

**JavaScript / React**:
- Componentes en `PascalCase`; el archivo se llama igual que el componente (`PantryScreen.js`).
- Hooks `useAlgo`; funciones y variables en `camelCase`; constantes de módulo en `UPPER_SNAKE`.
- Eventos de analytics en `snake_case` (`pantry_item_added`).

## Estructura de carpetas (`frontend/src/`)
- `screens/` — una pantalla por ruta. Subcarpeta `auth/` para login/registro.
- `components/<dominio>/` — UI por dominio: `pantry/`, `recipes/wizard/`, `library/`, `shopping/`, `cooking/`, `layout/`, `common/`.
- `components/ui/` — primitivos shadcn (generados; **no editar a mano**, ignorados por Prettier).
- `context/` — React Context (p. ej. `AuthContext`). `lib/` — utilidades sin UI (cliente Supabase, analytics, conversiones). `sql/` — esquema y migraciones.
- Imports con alias **`@/`** (`import { supabase } from "@/lib/supabaseClient"`).

## Patrones React
- Solo **componentes funcionales + hooks**. Carga de datos con `useCallback` + `useEffect`.
- **Supabase** siempre vía el singleton `@/lib/supabaseClient` (clave anónima; nunca service-role en cliente). La RLS hace de barrera: filtrar igualmente por `user_id` en queries por claridad.
- 🚦 **El semáforo no se calcula en cliente**: usar los RPC `compute_recipe_status` / `compute_library_status` (regla de oro, D-008).
- **Analytics**: `track("evento_snake_case", { props })` desde `@/lib/analytics`. Sin PII (el wrapper la elimina, pero no la pases).

## Tests y accesibilidad
- `data-testid` en `kebab-case` y estable (`recipe-detail-title`). Útiles para QA automatizada.
- IDs de pantalla del Mapa de Pantallas (`PAN-001`, `MOD-003`) como referencia en comentarios cuando aplique.
- `aria-label` en botones de solo-icono (`aria-label="Añadir ingrediente"`).

## i18n (pendiente)
- Hoy los textos están en español hardcodeado (i18next aún no instalado). Cuando se incorpore,
  **no** habrá strings de usuario hardcodeados: todo pasará por claves de traducción.
