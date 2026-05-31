# CLAUDE.md — KitchenBase

> Memoria de proyecto para Claude Code. Conciso a propósito: se carga en cada sesión.

## Qué es
**KitchenBase**: asistente de cocina doméstica con un **bucle cerrado**:
**Despensa → Semáforo de recetas → Lista de la compra → Despensa**.
Resuelve "¿qué cocino hoy con lo que tengo?" conectando inventario, recetario y compra.

## Estado y fase
- Transición del **prototipo** (construido en Emergent: React web + Supabase) al **desarrollo con Claude Code** (Fase 2, D-002; el destino definitivo es React Native + Expo).
- **Solo la Ola 1 (MVP) está en alcance.** No construir features de Ola 2 (catálogo comunitario, panel admin) ni Ola 3 (escáner, voz, grupos) salvo decisión explícita.
- Los 5 flujos críticos del MVP (D-027) están completos y el bucle cierra.

## Reglas de oro (no negociables)
- 🚦 **Semáforo SIEMPRE en servidor** vía RPC (`compute_recipe_status` / `compute_library_status`). **Nunca calcularlo en cliente** (D-008).
- 🔒 **Motor del semáforo congelado tras E1.1.** No modificar sus 5 funciones (`kb_base_unit_id`, `kb_convert_to_base`, `kb_find_pantry_match`, `compute_recipe_status`, `compute_library_status`) sin una decisión registrada.
- ⚖️ **Regla g/ml**: todo se reduce a unidad base (g o ml). La unidad base se resuelve por `is_base + dimension`, **nunca por el texto de `units.symbol`** (D-032/D-033). Conteo e imprecisos ('unidad', 'diente', 'pizca') son unidades normales con conversión por ingrediente en `unit_conversions` (D-034).
- 🔀 **Patrón XOR** en `recipe_ingredients` y `pantry_items`: exactamente uno de `ingredient_id` / `user_ingredient_id`.
- 🛡️ **RLS por `auth.uid()`** en todas las tablas de usuario; jamás saltársela. Las tablas de catálogo son solo-lectura para `authenticated` (escritura vía service-role / admin).
- 🗃️ **Esquema = migraciones versionadas e idempotentes** en `frontend/src/sql/migrations/`. "Hecho" significa **publicado en GitHub**, no escrito en local (OE-005).
- 🇪🇸 **App en español, código en inglés.** Todos los textos de usuario en español; todo el código (identificadores, nombres de tablas/funciones, comentarios, mensajes de commit) en inglés.
- 🎨 Diseño: **terracota `#C2714F`**, **Playfair Display** (títulos) + **Inter** (resto), **sin sombras ni gradientes**. Los colores del semáforo (verde `#22C55E`, amarillo `#EAB308`, naranja `#F97316`) son funcionales: no usarlos para nada más.
- 📋 Las decisiones llevan **ID `D-NNN`** y viven en el Registro de Decisiones. No contradecirlas: **actualizarlas**.

## Cómo trabajo (acordado con el usuario)
- **Operativa equilibrada**: autónomo en lo rutinario (fixes, documentación, tests); **consulto antes** en cambios de arquitectura, de esquema de BD, o que toquen una decisión `D-NNN`.
- **Código vs documentación**: si discrepan, **lo señalo y el usuario decide** caso por caso cuál prevalece (no asumo que gane uno u otro).

## Arquitectura
- **Frontend** (`frontend/`): React 19 + react-router 7, Tailwind + shadcn/ui (Radix), lucide-react. Build con CRA + craco. Habla **directamente con Supabase** desde el cliente (`src/lib/supabaseClient.js`); no hay backend propio en el bucle.
- **Supabase** (proyecto `ldrxurbtrbjhxmrpdtjr`): PostgreSQL + Auth + RLS + Realtime. **13 tablas**. El motor del semáforo son funciones PL/pgSQL. `frontend/src/sql/schema.sql` es el **snapshot vivo** (migraciones 001-010).
- **`backend/`**: boilerplate FastAPI + MongoDB de Emergent (Hello World). **Vestigial: no se usa.** No construir sobre él.
- **`@emergentbase/visual-edits`** (devDependency) es un artefacto de Emergent; no depender de él.
- Analytics: PostHog vía wrapper `src/lib/analytics.js` (sin PII, no-op si no hay `window.posthog`).
- **i18n pendiente**: la PRD prevé i18next (es/en) pero **no está instalado**; la UI está en español hardcodeado y la tabla `translations` está vacía.

## Comandos (Windows)
```
corepack enable            # habilita yarn 1.22 (pinned en package.json)
cd frontend
yarn install
yarn start                 # dev server (craco)
yarn build                 # build de producción
yarn test                  # tests CRA/Jest
```
Requiere variables en `frontend/.env`: `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY` (no versionadas).

## Base de datos (Supabase MCP)
- El **MCP de Supabase** está conectado en **read-only** (inspeccionar esquema, ejecutar SELECT, listar migraciones). Para aplicar DDL/migraciones hay que abrirlo a escritura o usar el SQL Editor.
- Triggers presentes: unicidad de cuarentena (D-031), propiedad de cuarentena en despensa. **Pendientes (deuda técnica)**: recálculo de `has_pending_ingredients` al validar admin (DT-001), fusión `merged_into_id` (DT-002), recálculo nutricional por trigger (DT-003) — hoy se hacen desde la app.

## Fuentes de verdad / contexto
- **Documentos de diseño** — viven **fuera del repo**, en OneDrive:
  `C:\Users\Enrique Paredes\OneDrive\Proyectos\KitchenBase\Documentación\`
  PRD (Doc 1), Modelo de Datos (Doc 2), Mapa de Pantallas (Doc 3), Registro de Decisiones (Doc 4), **Guía de Estilo (Doc 5)** y `kitchenbase_deuda_tecnica_v4.md`. Son la **intención de diseño**. (Los `.docx` son texto/Markdown, legibles directamente.)
- **Convenciones**: `docs/STYLEGUIDE.md` (código, en el repo) · Doc 5 Guía de Estilo (visual/UX, en Documentación).
- **`plan.md`** (raíz): bitácora de implementación por fases.
- El **repo** es la verdad del código; los documentos, la intención.
