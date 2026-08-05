# KitchenBase — Deuda Técnica y Decisiones Diferidas

Documento anexo. NO forma parte de los documentos principales del proyecto.

Propósito: registrar trabajo técnico pendiente, decisiones de diseño identificadas pero no abordadas, e implicaciones que hay que tener presentes cuando lleguemos a la fase correspondiente del desarrollo.

Versión 4 · Última actualización: Mayo 2026.

*Nota v4: se documenta el avance de la etapa E2 (sincronización de schema.sql, D-035) y la lección operativa OE-005 (una tarea está hecha cuando está publicada en GitHub, no cuando está escrita en el contenedor de Emergent). Se matiza OE-001 a la luz de ese hallazgo y se marca DT-004 como parcialmente resuelta (ajo→diente ya hecho en la migración 010).*

---

## 1. Deuda técnica pendiente

Cosas que hay que construir en algún momento y que actualmente no existen en el código.

### DT-001 — Trigger PostgreSQL para `recipes.has_pending_ingredients`

**Contexto.** El Documento 2 (Modelo de Datos, sección 8) especifica que cuando un administrador valida un ingrediente en cuarentena (cambia `user_ingredients.status` de `pending` a `validated` o `rejected`), el sistema debe actualizar automáticamente el campo `has_pending_ingredients` de todas las recetas que usan ese ingrediente.

**Estado actual.** El campo `has_pending_ingredients` existe en la tabla `recipes` y se actualiza correctamente desde la aplicación (cuando se añade o quita un ingrediente de una receta). Pero el trigger del lado del administrador NO está implementado. Si un admin valida un ingrediente pendiente, las recetas afectadas no se enteran automáticamente.

**Por qué no es bloqueante ahora.** Aún no existe panel de administración (D-020 está postpuesto). Sin admin, no hay validaciones, así que el trigger no tiene quién lo dispare.

**Cuándo abordarlo.** Al inicio de la Ola 2, junto con el panel de admin. Antes de que el primer admin valide su primer ingrediente.

**Estimación de complejidad.** Baja. Un trigger SQL de unas 15 líneas que se dispara en `AFTER UPDATE OF status ON user_ingredients`.

---

### DT-002 — Trigger PostgreSQL para fusión de ingredientes en cuarentena (recipe_ingredients + pantry_items)

**Contexto.** El Documento 2 (sección 8) especifica que cuando un admin fusiona un ingrediente en cuarentena con uno existente (rellena el campo `merged_into_id` en `user_ingredients`), las filas de `recipe_ingredients` que apuntaban al `user_ingredient_id` deben actualizarse automáticamente para apuntar al `ingredient_id` del catálogo global.

**Ampliación en v1.2 del Modelo de Datos (mayo 2026).** Tras la decisión D-029, la tabla `pantry_items` también puede referenciar `user_ingredients`. Por tanto el trigger de fusión debe actualizar también las filas de `pantry_items` que apuntaban al `user_ingredient_id`, reemplazándolas por el `ingredient_id` correspondiente. La restricción XOR debe seguir satisfaciéndose en ambas tablas tras la fusión.

**Estado actual.** No implementado. Mismo motivo que DT-001: aún no hay admin.

**Cuándo abordarlo.** Al inicio de la Ola 2, junto a DT-001.

**Estimación de complejidad.** Media. El trigger debe propagar el cambio y mantener la consistencia en dos tablas distintas: la fila en `recipe_ingredients` y `pantry_items` debe pasar de tener `user_ingredient_id` no nulo (e `ingredient_id` nulo) a tener `ingredient_id` no nulo (y `user_ingredient_id` nulo). Es un solo trigger que toca dos tablas.

---

### DT-003 — Cálculo nutricional automatizado al modificar recipe_ingredients

**Contexto.** El Documento 2 (sección 8) menciona que los campos nutricionales de `recipes` (kcal_per_serving, protein_per_serving, etc.) deberían recalcularse automáticamente vía trigger cuando se inserta, actualiza o elimina una fila en `recipe_ingredients`.

**Estado actual.** En el prompt del flujo Mis Recetas pedí que este cálculo se haga al final del asistente (cuando el usuario pulsa "Guardar receta"), implementado desde la aplicación. Esto cubre el caso normal, pero no cubre el caso futuro de "edición de recetas completas" donde los cambios pueden ocurrir fuera del wizard.

**Cuándo abordarlo.** Cuando se implemente la edición de recetas completas, o antes si queremos consistencia desde el principio.

**Estimación de complejidad.** Media. Hay que calcular la suma ponderada de los valores nutricionales de cada ingrediente convertido a unidad base, ignorando ingredientes en cuarentena. Es lógica de PL/pgSQL que ya describimos en el Documento 2.

---

### DT-004 — Revisar y completar conversiones de unidades del seed inicial [PARCIAL]

**Actualización v4 (mayo 2026).** El caso concreto del ajo ya está resuelto: la migración 010 (D-034) añadió la unidad ‘diente’ al catálogo y sembró la conversión (Ajo, diente) = 5 g. El resto de la auditoría del seed sigue pendiente. Lo que queda es revisar los demás ingredientes del seed para detectar conversiones culinarias naturales que falten, igual que faltaba la del ajo.

**Contexto.** El seed de ingredientes aplicado durante el desarrollo del flujo Despensa (23 ingredientes, 9 unidades, ~30 conversiones específicas) tiene gaps detectados durante la validación. El ajo era el ejemplo principal (ya resuelto). Es probable que haya otros ingredientes en situación similar (cebolla, patata, manzana ya tienen conversión a "unidad", pero conviene auditar el seed completo).

**Estado actual.** El catálogo funciona, pero algunos ingredientes obligan al usuario a usar la unidad base cuando sería más natural usar otra unidad culinaria. No es bloqueante: el usuario puede registrar gramos. Pero degrada la experiencia.

**Por qué no es bloqueante ahora.** Estamos en desarrollo y el catálogo se irá ampliando con el panel de admin. Las correcciones puntuales pueden esperar al pulido post-prototipo.

**Cuándo abordarlo.** Después de validar los 5 flujos críticos del prototipo (D-027), durante la fase de pulido. O puntualmente, si durante el desarrollo de un flujo concreto un ingrediente específico bloquea la prueba.

**Estimación de complejidad.** Baja. Es una migración SQL pequeña con INSERTs adicionales en `unit_conversions`. Cada ingrediente que requiera revisión necesita una o dos filas nuevas.

**Acción técnica concreta cuando se aborde.** Auditar los 23 ingredientes del seed y completar conversiones culinarias razonables para cada uno. Como referencia general: las hortalizas y frutas grandes (ajo, cebolla, patata, manzana, tomate, pimiento) admiten "unidad". Los líquidos (aceite, leche, vinagre) admiten "cucharada", "cucharadita" y "taza". Los sólidos pulverulentos (harina, azúcar, sal) admiten "cucharada", "cucharadita" y "taza" con conversiones específicas según densidad. Las hierbas frescas admiten "ramita" o "puñado" si se decide añadir esas unidades al catálogo `units`.

---

### DT-005 — Capa de i18n en runtime no implementada

**Contexto.** El PRD (§9) y la Ola 1 prevén i18next en el frontend y una tabla `translations` en Supabase (español e inglés) "desde el diseño inicial".

**Estado actual.** **i18next NO está instalado** (no aparece en `frontend/package.json`). La interfaz está en **español hardcodeado**. La tabla `translations` existe en el esquema pero está **vacía**: la arquitectura de datos está lista, pero no hay capa de traducción en runtime ni selector de idioma funcional.

**Por qué no es bloqueante ahora.** El MVP es español-first y el mercado prioritario es España. Añadir un idioma es trabajo de frontend, no de modelo de datos.

**Cuándo abordarlo.** Antes de incorporar el segundo idioma, o al reconstruir en React Native + Expo (i18next + expo-localization). Implica extraer todos los textos a claves de traducción.

**Estimación de complejidad.** Media.

---

### DT-006 — HOME-001 implementada como placeholder

**Contexto.** El Mapa de Pantallas (Doc 3) especifica la pantalla de Inicio con tres estados ricos (sin ingredientes / con ingredientes sin recetas / estado normal con recetas verdes) como parte de la Ola 1.

**Estado actual.** `frontend/src/screens/HomeScreen.js` es un placeholder "Próximamente". Los 5 flujos críticos (D-027) están completos, pero la Home real no se ha construido.

**Por qué no es bloqueante ahora.** La navegación funciona y la Home no es uno de los 5 flujos críticos del prototipo.

**Cuándo abordarlo.** Durante el pulido del MVP, consumiendo `compute_library_status` para mostrar las recetas verdes.

**Estimación de complejidad.** Media.

---

### DT-007 — `backend/` vestigial de Emergent

**Contexto.** El directorio `backend/` contiene boilerplate FastAPI + MongoDB de Emergent (un endpoint `status_check` de ejemplo). La app **no lo usa**: todo el bucle habla directamente con Supabase desde el frontend.

**Estado actual.** Conservado y documentado como **inerte** (`backend/README.md`), por decisión de mayo 2026. No se construye nada ahí.

**Cuándo abordarlo.** Eliminación opcional en el futuro (queda en el historial de git). Mientras tanto, no debe inducir a error: el destino definitivo es React Native + Expo, sin este backend.

**Estimación de complejidad.** Trivial (un borrado) si se decide eliminarlo.

---

### DT-008 — Recuperación de cuenta (contraseña olvidada) no implementada

**Contexto.** El Mapa de Pantallas (Doc 3, AUTH-003) prevé el enlace "¿Olvidaste tu contraseña?" que envía un email de recuperación y permite establecer una nueva contraseña. Supabase Auth lo soporta de forma nativa (`resetPasswordForEmail` + flujo de `recovery`).

**Estado actual.** **No implementado.** No hay enlace funcional de recuperación en el login ni pantalla para fijar una contraseña nueva tras el email de recuperación. Durante el prototipo se trabaja con cuentas conocidas.

**Por qué no es bloqueante ahora.** Estamos en validación; no hay usuarios reales que puedan quedar bloqueados.

**Cuándo abordarlo.** Antes de abrir la app a usuarios reales / lanzamiento. Flujo a construir: enlace en AUTH-003 → `supabase.auth.resetPasswordForEmail(email, { redirectTo })` → ruta/pantalla de *recovery* (deep link) que capture la sesión de recuperación → `supabase.auth.updateUser({ password })` → confirmación. Textos en español; mapear errores como el resto de auth.

**Estimación de complejidad.** Media.

---

## 2. Decisiones identificadas pero no formalizadas

*Actualmente no hay decisiones en esta sección.*

La entrada DD-001 (versionado de recetas públicas) se movió al Documento 4 como **D-028** en mayo de 2026.

---

## 3. Observaciones operativas sobre Emergent

Notas sobre el uso de la herramienta que no afectan al producto pero sí al proceso de desarrollo.

### OE-001 — Fuente de verdad: el preview, no el repositorio

Durante el desarrollo del flujo de Despensa, los archivos del repositorio descargable que muestra la plataforma estaban desincronizados respecto al estado real desplegado en el preview. El trabajo de Emergent estaba hecho y funcionaba correctamente en el preview, pero el repositorio aún mostraba el código del prompt fundacional.

**Implicación práctica.** Cuando termine un prompt, validar siempre primero en el preview público antes de revisar el repositorio. Si hay discrepancias, fiarse del preview.

**Matiz v4 (mayo 2026, etapa E2).** Hay un tercer nivel de desincronización más profundo que el descrito arriba. El contenedor de Emergent y el repositorio de GitHub del usuario no están unidos por un remoto git tradicional (no existe `origin/main` en el contenedor; `git branch -a` solo muestra `main` local). El código viaja del contenedor a GitHub por un mecanismo de sincronización propio de Emergent, no por `git push`. Consecuencia: un commit puede existir y ser correcto dentro del contenedor y aun así no haber llegado al GitHub que el usuario ve en el navegador. Por eso el preview, el repositorio descargable de la plataforma y el GitHub público pueden estar los tres en estados distintos. Ver OE-005 para la regla operativa que se deriva de esto.

---

### OE-002 — Aplicación de seed data automatizada vs. DDL manual

En el prompt del flujo de Despensa, di a Emergent dos opciones para los datos seed (aplicar automáticamente vs. dejar un archivo SQL para aplicar manualmente). Emergent eligió aplicar automáticamente, lo cual funcionó perfectamente para INSERTs de datos.

**Limitación descubierta posteriormente.** Para cambios de esquema (DDL: alter table, create index, alter publication, etc.) Emergent NO puede aplicar automáticamente. Esto es porque Supabase, vía PostgREST y la service-role key, solo expone operaciones de datos (SELECT/INSERT/UPDATE/DELETE), no de esquema. Cualquier modificación estructural requiere que el usuario la aplique manualmente desde el SQL Editor del dashboard.

**Implicación práctica.** Para INSERTS y similar, pedir aplicación directa. Para DDL, asumir que será un paso manual y diseñar el prompt para que Emergent prepare el SQL listo para pegar y pida explícitamente al usuario que lo aplique antes de continuar.

---

### OE-003 — Detalle UX del toggle "Marcar como básico" en MOD-001 [RESUELTO]

**Estado.** Resuelto en mayo de 2026 dentro del prompt v2 del flujo Mis Recetas (sección 6 del prompt, "Bonus: small UX fix"). El toggle ahora deshabilita y atenúa visualmente los campos Cantidad y Unidad cuando se activa, y limpia el valor de cantidad.

**Mantenido en el documento como referencia histórica.** No requiere acción.

---

### OE-004 — Migraciones SQL deberían vivir en el repositorio

**Contexto.** Durante el desarrollo, las migraciones de esquema se ejecutan ad hoc en el SQL Editor de Supabase (porque Emergent no puede aplicar DDL automáticamente, ver OE-002). Cada migración queda como un cambio aplicado en Supabase, pero NO queda registrada en el repositorio del proyecto. Esto significa que si en algún momento hay que reconstruir la base de datos desde cero, hay que reconstruir el historial de cambios desde memoria o desde el SQL Editor de Supabase, lo cual es frágil.

**Estado.** No bloqueante mientras estemos en fase de prototipado y haya una sola base de datos activa (la de Supabase para desarrollo). Sí será un problema cuando llegue la fase 2 con Claude Code, o cuando haya entornos separados (dev, staging, prod), o si se pierde el acceso al proyecto actual de Supabase y hay que reconstruir.

**Implicación práctica.** En algún momento futuro hay que adoptar una convención de migraciones versionadas en el repositorio. Una estructura sencilla sería una carpeta `frontend/src/sql/migrations/` con archivos numerados secuencialmente:

- `001_foundational_schema.sql` (el esquema inicial de las 14 tablas, ya aplicado)
- `002_unaccent_extension.sql` (la extensión que pidió el flujo Despensa, opcional)
- `003_despensa_seed.sql` (los 23 ingredientes, 10 categorías, etc. del flujo Despensa)
- `004_recipes_drafts.sql` (la migración aplicada para Mis Recetas: is_draft, draft_step, índice y realtime)
- `005_pantry_quarantine.sql` (la migración que aplicará D-029: pantry_items XOR con user_ingredients)
- `006_...` (futuras migraciones)

Idealmente cada archivo debe ser idempotente (con `if not exists` o `on conflict`) para que se pueda re-aplicar sin daño. Y debería existir un script o nota de cabecera que explique en qué orden aplicarlos sobre una base de datos vacía.

**Cuándo abordarlo.** Cuando completemos el prototipo (5 flujos críticos validados, ver D-027) y antes de pasar a Claude Code para la versión React Native. Es el momento natural porque ya no se podrá iterar en Emergent y conviene tener la base de datos como código antes del traspaso.

**Acción inmediata.** Ninguna. Anotación de proceso.

**Actualización (mayo 2026).** Estado real de las migraciones: existen `frontend/src/sql/migrations/005`–`010` en el repositorio, y las `001`–`004` están consolidadas dentro de `frontend/src/sql/schema.sql` (snapshot vivo, D-035). Queda pendiente la **pieza 2 de E2**: consolidar todo en una secuencia numerada y reaplicable sobre una base de datos vacía. Además, el snapshot **no incluye las sentencias `alter publication supabase_realtime`** (la adición de `pantry_items` y `recipes` a la publicación de realtime se aplicó por DDL pero no quedó reflejada en `schema.sql`); reconstruir el proyecto en una base vacía dejaría el realtime sin configurar.

---

### OE-005 — "Hecho" significa publicado en GitHub, no escrito en el contenedor

**Contexto.** Durante la etapa E2 (sincronizar schema.sql, D-035) el patrón de OE-001 se repitió en su forma más extrema y se aprendió la lección de fondo. Emergent declaró la tarea cerrada y los comandos que ejecutó eran internamente coherentes (el fichero a HEAD tenía 999 líneas y las anclas esperadas), pero al mirar el fichero en el GitHub del usuario seguía apareciendo el esquema fundacional. La causa raíz quedó clara al inspeccionar el repositorio del contenedor: no hay remoto git que una el contenedor con GitHub (ver matiz v4 de OE-001). El commit existía solo dentro del contenedor.

**Lección.** Para Emergent, "hecho" tiende a significar "escrito en disco" o, como mucho, "commiteado en el contenedor". Para el proyecto, "hecho" significa "publicado en el GitHub que sobrevive al contenedor". El contenedor de desarrollo es efímero; el GitHub del usuario es lo permanente. Un commit que solo vive en el contenedor es una nota en una pizarra que alguien va a borrar.

**Implicación práctica.** Una tarea que toca el repositorio no se cierra hasta verificar el cambio en el GitHub del usuario (o en el mecanismo de publicación que Emergent exponga), no solo con la palabra del agente ni con un `git log` del contenedor. La verificación barata y definitiva es abrir el fichero en GitHub y comprobar una o dos líneas centinela de su contenido. Las cabeceras no bastan: se pueden editar sin que baje el cuerpo del fichero.

**Estado.** Observación de proceso. La pieza 1 de E2 (snapshot de schema.sql) no se considera formalmente cerrada hasta confirmar la publicación en GitHub.

**Actualización (mayo 2026).** Confirmado: `frontend/src/sql/schema.sql` está publicado en el repositorio como snapshot fiel (≈999 líneas, refleja las migraciones 001-010, verificado contra la base de datos viva). La **pieza 1 de E2 se da por cerrada**.

---

## Cómo mantener este documento

Esta es una bitácora viva. Añadir entradas siempre que aparezca una decisión diferida, un detalle no implementado, o una observación sobre la herramienta. Mover entradas al Registro de Decisiones del proyecto (Documento 4) cuando se formalicen.

Las entradas de DT (deuda técnica) se eliminan cuando se resuelven (o se marcan como [RESUELTO] si conviene conservar el rastro). Las de DD (decisiones diferidas) se eliminan cuando se incorporan al Registro de Decisiones principal. Las de OE (observaciones operativas) se conservan como referencia histórica.
